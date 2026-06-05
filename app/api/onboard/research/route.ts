import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'node:crypto';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { estCostUsd, RESEARCH_MODEL } from '@/lib/usage-config.mjs';

// Atlas's site-research pass for onboarding v2. Given the owner's website, do ONE
// research pass with the same server-side web_search Aria's runner uses, and return
// STRUCTURED findings for Atlas to present for confirmation (never written to memory
// unconfirmed). Cost is logged to usage_log; one paid call per company (cached after).
const MAX_ITERATIONS = 6;

type SupabaseServer = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function getOrCreateDraftCompany(supabase: SupabaseServer, userId: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from('companies').select('id, research_findings')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await supabase
    .from('companies').insert({ user_id: userId, onboarding_complete: false }).select('id').single();
  if (error || !data) return null;
  return data.id;
}

// The shape Atlas confirms against. Every field is optional — an honest scan may
// come back thin, and Atlas says so rather than inventing.
const emitFindings: Anthropic.Tool = {
  name: 'emit_findings',
  description:
    'Return what you actually found about this business from the web search. Leave a field empty/blank if the site did not reveal it — never guess or invent. proof_found is REAL results/testimonials only.',
  // Plain text only — web_search results carry <cite> annotations; if they bleed
  // into field values Atlas would show markup to the customer. Stripped server-side
  // too (sanitizeFindings) as a belt-and-braces guard.
  input_schema: {
    type: 'object',
    properties: {
      company_name: { type: 'string' },
      industry: { type: 'string' },
      what_they_sell: { type: 'string' },
      target_customers: { type: 'string' },
      tone_guess: { type: 'string', description: "How the site's copy reads (e.g. warm, clinical, bold)" },
      proof_found: { type: 'array', items: { type: 'string' }, description: 'Real results/testimonials/differentiators found on the site' },
      logo_url_candidates: { type: 'array', items: { type: 'string' }, description: 'Image URLs that look like the logo' },
      color_candidates: { type: 'array', items: { type: 'string' }, description: 'Brand colors as hex if detectable' },
    },
    required: [],
  },
};

// web_search citation markup (e.g. <cite index="2-3">…</cite>) can bleed into the
// model's field values. Strip any tags from strings (recursively through arrays)
// so only clean prose is persisted and shown to the customer.
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

  // ONE paid research call per company — return the cached findings if we already ran.
  const { data: company } = await supabase
    .from('companies').select('research_findings').eq('id', companyId).maybeSingle();
  const cached = (company as { research_findings: unknown } | null)?.research_findings;
  if (cached != null) {
    return Response.json({ ok: true, cached: true, findings: cached });
  }

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
Research the website below with web_search, then call emit_findings ONCE with what you actually found.
HARD RULE: never invent. If the site doesn't reveal a field, leave it blank. proof_found must be REAL.
Write every field as PLAIN TEXT — no citation tags, no markup, no source brackets.
Be efficient: a couple of targeted searches, then emit. Do not keep searching after you have enough.
WEBSITE: ${url}`;

  const tools: Anthropic.Tool[] = [
    { type: 'web_search_20250305', name: 'web_search' } as unknown as Anthropic.Tool,
    emitFindings,
  ];
  const convo: Anthropic.MessageParam[] = [{ role: 'user', content: `Research ${url} and emit your findings.` }];

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

      // web_search hit its per-turn cap — continue with a user nudge (no prefill).
      if (resp.stop_reason === 'pause_turn') { convo.push({ role: 'user', content: 'Continue, then emit_findings.' }); continue; }

      const emit = resp.content.find((b) => b.type === 'tool_use' && b.name === 'emit_findings') as Anthropic.ToolUseBlock | undefined;
      if (emit) { findings = sanitizeFindings(emit.input as Record<string, unknown>); break; }

      if (resp.stop_reason === 'tool_use') {
        // A web_search tool_use is resolved server-side; just nudge toward emitting.
        convo.push({ role: 'user', content: 'When you have enough, call emit_findings now.' });
        continue;
      }
      break; // end_turn with no emit — fall through with whatever we have ({}).
    }

    // Persist findings (even {} — an honest "thin" result) so Atlas can re-inject them
    // for confirmation and we never pay for a second scan.
    await supabase.from('companies').update({ research_findings: findings }).eq('id', companyId);

    return Response.json({ ok: true, cached: false, findings, est_cost_usd: costUsd });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Research failed';
    return Response.json({ ok: false, error: msg, est_cost_usd: costUsd }, { status: 500 });
  }
}
