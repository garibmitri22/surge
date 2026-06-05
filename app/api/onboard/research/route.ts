import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'node:crypto';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { estCostUsd, RESEARCH_MODEL } from '@/lib/usage-config.mjs';
import { estimateHours } from '@/lib/pricing.mjs';
import { gateWork, debitHours } from '@/lib/hours.mjs';

// Atlas's site-research pass for onboarding v2. Fetches the page DIRECTLY first
// (web_search can't see unindexed sites / Facebook pages), then web_search fills
// gaps, then emits STRUCTURED findings for Atlas to confirm. Costs research_scan
// hours, but only for a MEANINGFUL scan — a thin/empty result charges 0 and is NOT
// cached (so a corrected URL re-scans). Cost telemetry still logs to usage_log.
const MAX_ITERATIONS = 6;
const MAX_SCANS_PER_DAY = 12; // anti-loop backstop only (hours are the real cap)

type SupabaseServer = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function getOrCreateDraftCompany(supabase: SupabaseServer, userId: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from('companies').select('id').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await supabase
    .from('companies').insert({ user_id: userId, onboarding_complete: false }).select('id').single();
  if (error || !data) return null;
  return data.id;
}

// A scan is MEANINGFUL when it actually learned something identifying. Only these
// consume hours + get cached; thin results are discarded so the next URL re-scans.
function isMeaningful(f: Record<string, unknown> | null | undefined): boolean {
  if (!f) return false;
  const name = typeof f.company_name === 'string' ? f.company_name.trim() : '';
  const sells = typeof f.what_they_sell === 'string' ? f.what_they_sell.trim() : '';
  return name.length > 0 || sells.length > 0;
}

const emitFindings: Anthropic.Tool = {
  name: 'emit_findings',
  description:
    'Return what you actually found about this business from the page content and web search. Leave a field blank if you did not find it — never guess or invent. proof_found is REAL results/testimonials only.',
  input_schema: {
    type: 'object',
    properties: {
      company_name: { type: 'string' },
      industry: { type: 'string' },
      what_they_sell: { type: 'string' },
      target_customers: { type: 'string' },
      tone_guess: { type: 'string', description: "How the site's copy reads (e.g. warm, clinical, bold)" },
      proof_found: { type: 'array', items: { type: 'string' }, description: 'Real results/testimonials/differentiators found' },
      logo_url_candidates: { type: 'array', items: { type: 'string' }, description: 'Image URLs that look like the logo' },
      color_candidates: { type: 'array', items: { type: 'string' }, description: 'Brand colors as hex if detectable' },
    },
    required: [],
  },
};

function stripTags(s: string): string {
  return s.replace(/<\/?cite[^>]*>/gi, '').replace(/<[^>]+>/g, '').trim();
}
function sanitizeFindings(f: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(f)) {
    if (typeof v === 'string') out[k] = stripTags(v);
    else if (Array.isArray(v)) out[k] = v.map((x) => (typeof x === 'string' ? stripTags(x) : x));
    else out[k] = v;
  }
  return out;
}

// Direct server-side fetch of the page: title + meta description + visible text,
// size-capped. web_search alone misses unindexed sites; this gives Atlas the real
// page. Failures are non-fatal (returns '') — Atlas falls back to web_search/interview.
async function fetchPageText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SurgeBot/1.0; +https://surge.app)' },
    });
    if (!res.ok) return '';
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/html') && !ct.includes('text/plain')) return '';
    const html = (await res.text()).slice(0, 200_000);
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim();
    const desc = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] || '').trim();
    const body = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return [title && `TITLE: ${title}`, desc && `DESCRIPTION: ${desc}`, body && `TEXT: ${body.slice(0, 12_000)}`]
      .filter(Boolean).join('\n');
  } catch {
    return '';
  }
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return new Response('ANTHROPIC_API_KEY is not set on the server.', { status: 500 });

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  let body: { url?: string };
  try { body = await request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }
  const url = (body.url || '').trim();
  if (!/^https?:\/\/.+/i.test(url)) return new Response('A valid http(s) website URL is required', { status: 400 });

  const companyId = await getOrCreateDraftCompany(supabase, user.id);
  if (!companyId) return new Response('Could not start onboarding', { status: 500 });

  // Return cached findings only if a PRIOR scan was meaningful. A thin/empty scan is
  // never persisted, so a corrected URL gets a fresh scan instead of permanent blindness.
  const { data: company } = await supabase
    .from('companies').select('research_findings').eq('id', companyId).maybeSingle();
  const cached = (company as { research_findings: Record<string, unknown> | null } | null)?.research_findings;
  if (isMeaningful(cached)) {
    return Response.json({ ok: true, cached: true, findings: cached });
  }

  // Anti-loop backstop (NOT a product cap — hours are the cap): cap scans/day/company
  // so a wrong-URL loop can't leak API spend even though thin scans charge 0.
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count: scansToday } = await supabase
    .from('usage_log').select('id', { count: 'exact', head: true })
    .eq('company_id', companyId).eq('task_id', 'onboard-research').gte('created_at', since);
  if ((scansToday ?? 0) >= MAX_SCANS_PER_DAY) {
    return Response.json({ ok: false, error: 'Too many scans today; please add the details by talking to Atlas.' }, { status: 429 });
  }

  // Hours gate: a meaningful scan costs research_scan hours. Gate up front; charge on
  // completion only if meaningful (thin = 0). Out of hours = in-character overtime moment.
  const gate = await gateWork(supabase, companyId, 'research_scan', 'Atlas');
  if (!gate.ok) {
    return Response.json({ ok: false, out_of_hours: true, message: gate.message, balance_hours: gate.balance, hours_needed: gate.estimate }, { status: 402 });
  }

  const pageText = await fetchPageText(url);

  const client = new Anthropic();
  const runId = randomUUID();
  let costUsd = 0;
  async function recordUsage(model: string, usage: Anthropic.Usage | null | undefined) {
    if (!usage) return;
    const inputTokens = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
    const cacheReadTokens = usage.cache_read_input_tokens ?? 0;
    const outputTokens = usage.output_tokens ?? 0;
    const webSearches = usage.server_tool_use?.web_search_requests ?? 0;
    const est = estCostUsd({ model, input_tokens: inputTokens, cache_read_tokens: cacheReadTokens, output_tokens: outputTokens, web_searches: webSearches });
    costUsd = +(costUsd + est).toFixed(5);
    await supabase.from('usage_log').insert({
      company_id: companyId!, employee_id: 'atlas', task_id: 'onboard-research', run_id: runId,
      model, input_tokens: inputTokens, cache_read_tokens: cacheReadTokens, output_tokens: outputTokens,
      web_searches: webSearches, est_cost_usd: est,
    });
  }

  const system = `You are Atlas, a Chief of Staff doing pre-onboarding homework on a new client's business.
You have the PAGE CONTENT below (fetched directly from their site). Read it first; use web_search ONLY to fill gaps it doesn't cover, then call emit_findings ONCE.
HARD RULES: never invent. If neither the page nor search reveals a field, leave it blank. proof_found must be REAL. Plain text only, no citation tags or markup.
If the page content is empty and search finds little, emit blank fields. Do NOT fabricate a description.
WEBSITE: ${url}

----- PAGE CONTENT (direct fetch; may be empty if the site blocked us) -----
${pageText || '(empty — direct fetch returned nothing; rely on web_search, and if that is thin, emit blank)'}
----- END PAGE CONTENT -----`;

  const tools: Anthropic.Tool[] = [
    { type: 'web_search_20250305', name: 'web_search' } as unknown as Anthropic.Tool,
    emitFindings,
  ];
  const convo: Anthropic.MessageParam[] = [{ role: 'user', content: `Research ${url} using the page content above (and web_search for gaps), then emit your findings.` }];

  let findings: Record<string, unknown> = {};
  try {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const resp = await client.messages.create({
        model: RESEARCH_MODEL,
        max_tokens: 1500,
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        tools,
        messages: convo,
      });
      await recordUsage(RESEARCH_MODEL, resp.usage);
      convo.push({ role: 'assistant', content: resp.content });
      if (resp.stop_reason === 'pause_turn') { convo.push({ role: 'user', content: 'Continue, then emit_findings.' }); continue; }
      const emit = resp.content.find((b) => b.type === 'tool_use' && b.name === 'emit_findings') as Anthropic.ToolUseBlock | undefined;
      if (emit) { findings = sanitizeFindings(emit.input as Record<string, unknown>); break; }
      if (resp.stop_reason === 'tool_use') { convo.push({ role: 'user', content: 'When you have enough, call emit_findings now.' }); continue; }
      break;
    }

    // Charge + persist ONLY for a meaningful scan. Thin/empty: persist nothing
    // (re-scan stays open) and charge 0 — the customer never pays for our misses.
    const meaningful = isMeaningful(findings);
    let balanceAfter = gate.balance;
    if (meaningful) {
      await supabase.from('companies').update({ research_findings: findings }).eq('id', companyId);
      balanceAfter = await debitHours(supabase, companyId, estimateHours('research_scan'), 'Atlas site research', { employeeId: 'atlas', refType: 'research', refId: companyId });
    }
    return Response.json({ ok: true, cached: false, meaningful, findings, hours: { charged: meaningful ? estimateHours('research_scan') : 0, balance: balanceAfter }, est_cost_usd: costUsd });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Research failed';
    return Response.json({ ok: false, error: msg, est_cost_usd: costUsd }, { status: 500 });
  }
}
