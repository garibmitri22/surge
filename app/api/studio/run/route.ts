import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { estCostUsd, WRITING_MODEL } from '@/lib/usage-config.mjs';
import { injectPricing } from '@/lib/pricing.mjs';
import { gateWork, debitHours, estimateHours } from '@/lib/hours.mjs';

// Nova's Studio engine — same agent pattern as Aria's run (app/api/agent/run), trimmed
// for content: no web search, she generates a small batch of on-brand pieces from the
// SHARED company brain (brand voice + ICP + offer from memory_entries + the company
// profile). Drafts only — nothing is published (P1). Metered as nova_content (~1h),
// gated/debited via lib/hours.mjs (is_internal bypass, 0 on a thin/failed run).

const MAX_ITERATIONS = 6;
const EMPLOYEE_ID = 'nova';

type SupabaseServer = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function getCompanyId(supabase: SupabaseServer): Promise<string | null> {
  const { data } = await supabase.from('companies').select('id').order('created_at', { ascending: false }).limit(1).maybeSingle();
  return data?.id ?? null;
}

const tools: Anthropic.Tool[] = [
  {
    name: 'create_content_piece',
    description:
      'Save ONE finished, on-brand content draft (pending owner approval — nothing is published). Author it natively for its platform, in THIS company\'s brand voice. One idea per piece.',
    input_schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['post', 'script', 'ugc_brief', 'caption'] },
        platform: { type: 'string', enum: ['instagram', 'tiktok', 'linkedin', 'x', 'generic'] },
        title: { type: 'string', description: 'A short internal label / the hook line' },
        body: { type: 'string', description: 'The full piece — post copy, second-stamped script, UGC brief, or caption' },
        brief: { type: 'string', description: 'The angle/objective this piece is chasing (one line)' },
      },
      required: ['type', 'title', 'body'],
    },
  },
  {
    name: 'log_activity',
    description: 'Record a short activity-feed entry as you work.',
    input_schema: { type: 'object', properties: { action: { type: 'string' }, detail: { type: 'string' } }, required: ['action'] },
  },
  {
    name: 'report',
    description: 'Post a one-line summary of the batch you made (real counts), then STOP.',
    input_schema: { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'] },
  },
];

interface StudioCtx { companyId: string; counters: { pieces: number }; brief: string; lastError: string | null }

async function executeTool(name: string, input: Record<string, unknown>, supabase: SupabaseServer, ctx: StudioCtx): Promise<string> {
  if (name === 'create_content_piece') {
    const type = String(input.type ?? '').trim();
    const title = String(input.title ?? '').trim();
    const body = String(input.body ?? '').trim();
    if (!['post', 'script', 'ugc_brief', 'caption'].includes(type)) return 'ERROR: type must be post|script|ugc_brief|caption.';
    if (!title || !body) return 'ERROR: title and body are required.';
    const platform = ['instagram', 'tiktok', 'linkedin', 'x', 'generic'].includes(String(input.platform)) ? String(input.platform) : 'generic';
    const { error } = await supabase.from('content_pieces').insert({
      company_id: ctx.companyId, employee_id: EMPLOYEE_ID, type, platform, title, body,
      status: 'draft', brief: (input.brief as string)?.trim() || ctx.brief || null,
    });
    if (error) {
      // Remember the real DB error so the run can fail LOUDLY if nothing ends up saved
      // (e.g. the content_pieces migration isn't applied) — never a silent fake success.
      ctx.lastError = error.message;
      return `ERROR saving piece: ${error.message}`;
    }
    ctx.counters.pieces++;
    return `Saved ${type} for ${platform} (draft).`;
  }
  if (name === 'log_activity') {
    await supabase.from('activity_log').insert({
      id: 'a' + Date.now() + Math.floor(Math.random() * 1000),
      company_id: ctx.companyId, employee_id: EMPLOYEE_ID,
      action: String(input.action ?? ''), detail: (input.detail as string) ?? null,
      timestamp: 'just now', sort_order: Date.now(),
    });
    return 'Logged.';
  }
  if (name === 'report') return 'Report noted.';
  return `Unknown tool: ${name}`;
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return new Response('ANTHROPIC_API_KEY is not set on the server.', { status: 500 });

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  let payload: { angle?: string };
  try { payload = await request.json(); } catch { payload = {}; }
  const angle = (payload.angle || '').toString().slice(0, 500).trim();

  const companyId = await getCompanyId(supabase);
  if (!companyId) return new Response('Complete onboarding first', { status: 400 });

  const { data: company } = await supabase.from('companies').select('*').eq('id', companyId).maybeSingle();
  const { data: memory } = await supabase.from('memory_entries').select('type, title, content').eq('company_id', companyId).order('sort_order', { ascending: false }).limit(30);

  // Brand voice is REQUIRED — Nova never invents a voice. If the brain has none yet,
  // refuse and point the owner to onboarding (no spend, no gate).
  const voiceNotes = (memory ?? []).filter((m) => ['voice', 'brand'].includes(m.type)).map((m) => m.content).join(' | ');
  const brandVoice = (company?.brand_tone?.trim() || voiceNotes).trim();
  if (!brandVoice) {
    return Response.json({
      ok: false, reason: 'no_brand_voice',
      message: 'Nova needs your brand voice before she writes anything — otherwise it would just be generic AI filler. Finish onboarding (or add your brand tone in Settings) and she\'ll write in your voice.',
    }, { status: 400 });
  }

  // Hours gate (checked before any API spend; charged on completion; 0 if thin).
  const gate = await gateWork(supabase, companyId, 'nova_content', 'Nova');
  if (!gate.ok) {
    return Response.json({ ok: false, out_of_hours: true, message: gate.message, balance_hours: gate.balance, hours_needed: gate.estimate, created_this_run: { pieces: 0 } }, { status: 402 });
  }

  let persona = '';
  try { persona = await readFile(path.join(process.cwd(), 'personas', `${EMPLOYEE_ID}.md`), 'utf8'); } catch { persona = ''; }

  const icpNotes = (memory ?? []).filter((m) => ['icp', 'offer', 'goal'].includes(m.type)).map((m) => `[${m.type}] ${m.content}`).join('\n');
  const companyBlock = company
    ? `Company: ${company.company_name} | Industry: ${company.industry} | ICP: ${company.target_customers} | Brand tone: ${company.brand_tone}`
    : 'No company profile.';

  const system = injectPricing(`${persona || `You are Nova, Marketing Director.`}

=====================================================================
LIVE COMPANY CONTEXT (this is who you write for — sound like THEM, never generic)
${companyBlock}
BRAND VOICE: ${brandVoice}
ICP / OFFER / GOALS:
${icpNotes || 'none beyond the profile above'}

=====================================================================
EXECUTION MODE — produce a small batch of content drafts NOW.
${angle ? `The owner's angle/topic for this batch: "${angle}"` : 'No angle given — choose strong on-brand angles yourself from the brand + ICP above ("surprise me").'}

RULES (binding):
1. ON-BRAND ONLY. Every piece must sound like THIS company's brand voice above — never generic filler. Apply your full Craft Discipline (hook honesty, one idea per piece, evidence over adjectives, platform-native, plain language).
2. NEVER fabricate stats, customers, testimonials, or results (Hard Guardrail #1/#2). Any persona/scenario in a UGC brief is explicitly illustrative ("imagine a clinic owner who…"), never a real customer.
3. Make 4–6 pieces across a useful mix of types (post, script, ugc_brief, caption) and platforms — each native to its platform, each via create_content_piece. These are DRAFTS for owner approval; nothing is published.
4. log_activity once near the start; when the batch is done call report ONCE with the real count, then STOP.
5. Be efficient — you can call create_content_piece several times in one turn.`);

  const client = new Anthropic();
  const counters = { pieces: 0 };
  const runId = randomUUID();
  const cost = { usd: 0 };
  async function recordUsage(model: string, usage: Anthropic.Usage | null | undefined) {
    if (!usage) return;
    const inputTokens = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
    const cacheReadTokens = usage.cache_read_input_tokens ?? 0;
    const outputTokens = usage.output_tokens ?? 0;
    const est = estCostUsd({ model, input_tokens: inputTokens, cache_read_tokens: cacheReadTokens, output_tokens: outputTokens });
    cost.usd = +(cost.usd + est).toFixed(5);
    await supabase.from('usage_log').insert({
      company_id: companyId!, employee_id: EMPLOYEE_ID, run_id: runId,
      model, input_tokens: inputTokens, cache_read_tokens: cacheReadTokens, output_tokens: outputTokens, web_searches: 0, est_cost_usd: est,
    });
  }

  const ctx: StudioCtx = { companyId, counters, brief: angle, lastError: null };
  const convo: Anthropic.MessageParam[] = [{ role: 'user', content: 'Create the batch now.' }];
  let reported = false;
  let lastText = '';

  try {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const resp = await client.messages.create({
        model: WRITING_MODEL,
        max_tokens: 4096,
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        tools,
        messages: convo,
      });
      await recordUsage(WRITING_MODEL, resp.usage);
      convo.push({ role: 'assistant', content: resp.content });
      lastText = resp.content.filter((b) => b.type === 'text').map((b) => (b as Anthropic.TextBlock).text).join('') || lastText;

      if (resp.stop_reason === 'tool_use') {
        const results: Anthropic.ToolResultBlockParam[] = [];
        for (const block of resp.content) {
          if (block.type === 'tool_use') {
            if (block.name === 'report') reported = true;
            const out = await executeTool(block.name, block.input as Record<string, unknown>, supabase, ctx);
            results.push({ type: 'tool_result', tool_use_id: block.id, content: out });
          }
        }
        if (results.length === 0) break;
        convo.push({ role: 'user', content: results });
        if (reported) break;
        continue;
      }
      break; // end_turn
    }

    // HONEST OUTCOME — a run that saved ZERO pieces is NOT a success. Never return ok:true
    // with pieces:0 (that made the UI cheer "Nova drafted 0 pieces — review them below" with
    // nothing to review). Charge nothing (the customer never pays for a miss) and fail loudly,
    // surfacing the real cause: a DB/save error (usually the content_pieces migration not being
    // applied) vs. the model genuinely producing nothing.
    if (counters.pieces === 0) {
      await debitHours(supabase, companyId, 0, 'Nova content batch (no output)', { employeeId: EMPLOYEE_ID, refType: 'content', refId: runId }).catch(() => {});
      const message = ctx.lastError
        ? `Nova couldn't save her work (${ctx.lastError}). Nothing was produced — this usually means the content storage isn't set up yet. No hours were charged.`
        : (lastText.trim()
            ? `Nova didn't save any content this run. ${lastText.slice(0, 300)}`
            : 'Nova finished without producing any content this run — nothing was saved. Give her a sharper angle and try again. No hours were charged.');
      return Response.json({
        ok: false, reason: ctx.lastError ? 'save_failed' : 'no_pieces',
        created_this_run: counters, message, usage: { est_cost_usd: cost.usd },
      }, { status: 422 });
    }

    const charged = estimateHours('nova_content');
    const balanceAfter = await debitHours(supabase, companyId, charged, 'Nova content batch', { employeeId: EMPLOYEE_ID, refType: 'content', refId: runId });
    await supabase.from('activity_log').insert({
      id: 'a' + Date.now() + Math.floor(Math.random() * 1000),
      company_id: companyId, employee_id: EMPLOYEE_ID,
      action: `Drafted ${counters.pieces} content piece${counters.pieces > 1 ? 's' : ''} for your review`,
      detail: angle || null, timestamp: new Date().toISOString(), sort_order: Date.now(),
    });

    return Response.json({
      ok: true, created_this_run: counters, hours: { charged, balance: balanceAfter, thin: false },
      usage: { est_cost_usd: cost.usd }, reported, message: lastText.slice(0, 1000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Run failed';
    return Response.json({ ok: false, error: msg, created_this_run: counters, hours: { charged: 0 } }, { status: 500 });
  }
}
