import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { resolveCanonicalCompanyId } from '@/lib/company-resolve';
import { estCostUsd, RESEARCH_MODEL, WRITING_MODEL, DAILY_TOPUP_TARGET } from '@/lib/usage-config.mjs';
import { injectPricing, OFFER_NAME, FOUNDING_LABEL, PRICE_GATE, estimateHours, formatHours } from '@/lib/pricing.mjs';
import { gateWork, debitHours } from '@/lib/hours.mjs';
import { createTrackedLink } from '@/lib/sign.mjs';
import { embedTrackedCta } from '@/lib/email.mjs';
import { after } from 'next/server';
import * as Sentry from '@sentry/nextjs';

// Function run window = 300s (the Pro ceiling surge-hq is on). MUST be a STATIC LITERAL:
// Next.js validates route-segment config exports at build ("Collecting page data") and a
// computed value like Number(process.env.X) fails with "Invalid segment configuration export"
// (webpack/Vercel catches it even though local Turbopack doesn't). The run's wall-clock
// research budget below is matched to this 300s ceiling.
export const maxDuration = 300;

// Loop ceiling = the HARD wall-time bound. Web-search research turns run ~25–40s each, so the
// iteration count, not lead count, drives wall-time. 6 keeps even a slow run (≈40s/iter →
// ~240s + ~20s parallel drafting ≈ 260s) comfortably under the 300s Pro ceiling. Paired with
// LEAD_CAP below, which stops the loop early once we already have enough leads (so a lead-rich
// market doesn't burn the full budget over-researching). Manual is repeat-clickable + dedupe-
// idempotent, and the daily top-up refills — so a tight per-run cap loses nothing.
const MAX_ITERATIONS = 6;

// The day-one activation / first run must COMPLETE inside the serverless cap (~60s on
// Hobby), or it gets killed mid-loop and writes nothing. So we scope that run smaller —
// fewer iterations, a modest lead target, fewer drafts — because a real batch that
// FINISHES beats a big one that gets killed. Manual runs are similarly capped (above).
const ACTIVATION_MAX_ITERATIONS = 6;

// The daily top-up run (invoked session-less by /api/cron/topup). Even tighter than
// activation so it shares no risk with the 60s wall, and CHARGED (not comped) — it's
// normal metered pipeline work. The fresh-lead target (DAILY_TOPUP_TARGET) is the shared
// config default; the cron may pass a smaller tapered target as month-end hours shrink.
const TOPUP_MAX_ITERATIONS = 8;

// Max tool calls run concurrently within one model turn — chiefly the draft_email writes,
// each a Sonnet call. Running them in parallel (instead of awaiting one-by-one) is the big
// wall-time win that keeps a full run comfortably under the 300s ceiling. Bounded so a turn
// that emits many tool calls can't fan out without limit.
const DRAFT_CONCURRENCY = 5;

// Bounded concurrent map: runs `fn` over `items` with at most `limit` in flight, preserving
// input order in the result. Used to parallelize a turn's tool executions.
async function mapBounded<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

type SupabaseServer = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function getCompanyId(supabase: SupabaseServer, userId: string | null): Promise<string | null> {
  return resolveCanonicalCompanyId(supabase, userId);
}

async function findOrCreateConversation(supabase: SupabaseServer, companyId: string, employeeId: string, title: string): Promise<string> {
  const { data: existing } = await supabase
    .from('conversations').select('id').eq('company_id', companyId).eq('employee_id', employeeId)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (existing) return existing.id;
  const { data: created } = await supabase
    .from('conversations').insert({ company_id: companyId, employee_id: employeeId, title }).select('id').single();
  return created!.id;
}

// ---- Tools -----------------------------------------------------------------

const tools: Anthropic.Tool[] = [
  // research_web — Anthropic's server-side web search (real businesses only).
  // Using the non-dynamic-filtering version: direct results, no code-execution
  // container to manage across the agentic loop.
  { type: 'web_search_20250305', name: 'web_search' } as unknown as Anthropic.Tool,
  {
    name: 'create_lead',
    description:
      'Insert ONE real business found via web_search as a scored lead. Every field must come from real research — never invent. score_reasons must include all four rubric parts.',
    input_schema: {
      type: 'object',
      properties: {
        business_name: { type: 'string' },
        vertical: { type: 'string', enum: ['med_spa', 'real_estate', 'gym', 'other'] },
        location: { type: 'string' },
        website: { type: 'string' },
        contact_name: { type: 'string' },
        contact_role: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        source_url: { type: 'string', description: 'The real URL where this business/details were found' },
        score: { type: 'integer', description: '0-100 total' },
        score_reasons: {
          type: 'object',
          description: 'Rubric breakdown, each with points + a one-line reason',
          properties: {
            icp_fit: { type: 'object', properties: { points: { type: 'integer' }, reason: { type: 'string' } }, required: ['points', 'reason'] },
            pain: { type: 'object', properties: { points: { type: 'integer' }, reason: { type: 'string' } }, required: ['points', 'reason'] },
            ability: { type: 'object', properties: { points: { type: 'integer' }, reason: { type: 'string' } }, required: ['points', 'reason'] },
            reachability: { type: 'object', properties: { points: { type: 'integer' }, reason: { type: 'string' } }, required: ['points', 'reason'] },
          },
          required: ['icp_fit', 'pain', 'ability', 'reachability'],
        },
        ad_signal: { type: 'string', description: 'ACTIVE-ADVERTISER signal (only if you verified it via the Meta Ad Library / Google Ads Transparency Center): what they advertise + roughly how long it has run, e.g. "running the same FB roofing ad ~5 months". Long-running ads = committed budget = warmest. Leave blank if they are not a verified advertiser.' },
        next_action: { type: 'string', description: 'The next concrete step for this lead (Lead Lifeline law)' },
        next_action_at: { type: 'string', description: 'When the next step is due (YYYY-MM-DD)' },
        notes: { type: 'string' },
      },
      required: ['business_name', 'vertical', 'source_url', 'score', 'score_reasons', 'next_action', 'next_action_at'],
    },
  },
  // NOTE: drafting is NOT a model tool. The agent researches + scores only; the system drafts
  // the top-N leads by score AFTER the loop, in one bounded parallel batch (executeTool's
  // 'draft_email' branch is reused there). The model emitting draft_email one-per-turn used to
  // serialize ~30–40s per draft and dominate wall-time — this removes that from the loop.
  {
    name: 'log_activity',
    description: 'Record a short activity-feed entry as you work (e.g. "Researched 14 businesses in the target market").',
    input_schema: { type: 'object', properties: { action: { type: 'string' }, detail: { type: 'string' } }, required: ['action'] },
  },
  {
    name: 'report',
    description: 'Post a final summary message to the owner with REAL counts from the work you did. Call this once at the end, then stop.',
    input_schema: { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'] },
  },
];

function todayISO() { return new Date().toISOString().split('T')[0]; }

type LeadRow = Record<string, unknown>;

interface ToolCtx {
  companyId: string;
  employeeId: string;
  conversationId: string;
  counters: { leads: number; drafts: number; dups: number };
  // Writes the final prospect-facing email on the WRITING_MODEL (Sonnet), records its cost.
  // Returns the AI-transparency A/B variant it rolled ('ps' | 'no_ps') so it's stored on the draft.
  writeColdEmail: (lead: LeadRow) => Promise<{ subject: string; body: string; variant: string }>;
}

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  supabase: SupabaseServer,
  ctx: ToolCtx
): Promise<string> {
  const { companyId, employeeId, conversationId, counters } = ctx;
  if (name === 'create_lead') {
    const row = {
      company_id: companyId,
      business_name: String(input.business_name ?? '').trim(),
      vertical: (input.vertical as string) || 'other',
      location: (input.location as string) ?? null,
      website: (input.website as string) ?? null,
      contact_name: (input.contact_name as string) ?? null,
      contact_role: (input.contact_role as string) ?? null,
      email: (input.email as string) ?? null,
      phone: (input.phone as string) ?? null,
      source_url: String(input.source_url ?? '').trim(),
      score: typeof input.score === 'number' ? input.score : 0,
      score_reasons: input.score_reasons ?? {},
      status: 'qualified',
      next_action: String(input.next_action ?? 'Review and draft outreach'),
      next_action_at: (input.next_action_at as string) || todayISO(),
      notes: (input.notes as string) ?? null,
    };
    if (!row.business_name || !row.source_url) return 'ERROR: business_name and source_url are required (real data only).';
    const { data, error } = await supabase.from('leads').insert(row).select('id').single();
    if (error) {
      // A duplicate isn't an error — it's the dedupe working. Count it so a top-up run
      // can tell when the local market is tapped (mostly repeats) and back off.
      if (error.code === '23505') { counters.dups++; return `Skipped duplicate: "${row.business_name}" is already in the pipeline.`; }
      return `ERROR creating lead: ${error.message}`;
    }
    counters.leads++;
    // Active-advertiser signal → the post-click "speed-to-lead leak" angle in the writer.
    // Best-effort: stored in the relationship column (reactivation_migration). If that
    // column isn't live yet, skip it — one additive feature must never break lead creation.
    const adSignal = (input.ad_signal as string)?.trim();
    if (adSignal && data?.id) {
      await supabase.from('leads').update({ relationship: adSignal }).eq('id', data.id).then(() => {}, () => {});
    }
    return `Created lead. lead_id: ${data!.id} — "${row.business_name}" (score ${row.score}). Use this lead_id for draft_email.`;
  }

  if (name === 'draft_email') {
    const leadId = String(input.lead_id ?? '');
    if (!leadId) return 'ERROR: lead_id required (from create_lead result).';
    const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).eq('company_id', companyId).maybeSingle();
    if (!lead) return 'ERROR: lead not found for that lead_id.';

    // Prospect-facing copy is written by the senior writer (Sonnet), not the
    // research model. Orchestrator-provided subject/body are fallback hints only.
    let subject = String(input.subject ?? '').trim();
    let body = String(input.body ?? '').trim();
    let abVariant: string | null = null;
    try {
      const written = await ctx.writeColdEmail(lead as LeadRow);
      if (written.subject && written.body) { subject = written.subject; body = written.body; abVariant = written.variant; }
    } catch {
      // Sonnet write failed — fall back to any hint the orchestrator supplied.
    }
    if (!subject || !body) return 'ERROR: could not produce email subject/body.';

    // Embed the ONE signed, per-lead tracked CTA link (the warm signal). The writer
    // leaves a {{CTA_URL}} placeholder; we swap in the real link (or append one).
    try { const cta = await createTrackedLink(supabase, leadId, companyId); body = embedTrackedCta(body, cta); } catch { /* couldn't allocate a code — leave copy as-is */ }

    // Insert the core draft first (never block a real draft on an additive column), then set
    // the A/B variant best-effort — same pattern as leads.relationship. Robust whether or not
    // the ab_variant migration is live (Supabase returns PGRST204, not 42703, for a missing
    // column, so an error-code guard is fragile — this avoids the guess entirely).
    const { data: inserted, error } = await supabase.from('lead_drafts').insert({
      lead_id: leadId,
      company_id: companyId,
      channel: 'email',
      sequence_step: typeof input.sequence_step === 'number' ? input.sequence_step : 1,
      subject,
      body,
      approval_status: 'pending',
    }).select('id').single();
    if (error) return `ERROR creating draft: ${error.message}`;
    if (abVariant && inserted?.id) {
      await supabase.from('lead_drafts').update({ ab_variant: abVariant }).eq('id', inserted.id).then(() => {}, () => {});
    }
    await supabase.from('leads').update({ status: 'drafted' }).eq('id', leadId).eq('company_id', companyId);
    counters.drafts++;
    return `Draft saved (pending approval). Nothing was sent.`;
  }

  if (name === 'log_activity') {
    await supabase.from('activity_log').insert({
      id: 'a' + Date.now() + Math.floor(Math.random() * 1000),
      company_id: companyId,
      employee_id: employeeId,
      action: String(input.action ?? ''),
      detail: (input.detail as string) ?? null,
      timestamp: 'just now',
      sort_order: Date.now(),
    });
    return 'Logged.';
  }

  if (name === 'report') {
    const summary = String(input.summary ?? '');
    await supabase.from('messages').insert({ conversation_id: conversationId, role: 'assistant', content: summary });
    return 'Report posted to the owner.';
  }

  return `Unknown tool: ${name}`;
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return new Response('ANTHROPIC_API_KEY is not set on the server.', { status: 500 });

  let body: { taskId?: string; activation?: boolean; topup?: boolean; companyId?: string; target?: number };
  try { body = await request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }

  // Caller auth: either a logged-in OWNER (session cookie) or the internal CRON
  // (Authorization: Bearer $CRON_SECRET). The daily top-up runs session-less across every
  // company, so it authenticates with the cron secret and uses the service-role client —
  // every query below is already explicitly scoped by company_id, so bypassing RLS is safe.
  const cronSecret = process.env.CRON_SECRET;
  const isCron = !!cronSecret && (request.headers.get('authorization') || '') === `Bearer ${cronSecret}`;

  let supabase: SupabaseServer;
  let userId: string | null = null;
  if (isCron) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) return new Response('Service role not configured', { status: 503 });
    supabase = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { persistSession: false } });
  } else {
    supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response('Unauthorized', { status: 401 });
    userId = user.id;
  }

  const taskId = (body.taskId || '').trim();
  if (!taskId) return new Response('taskId required', { status: 400 });

  // The cron passes the company explicitly (no session to infer it from); an owner run
  // resolves their ONE canonical company (deterministic + user_id-scoped).
  const companyId = isCron ? ((body.companyId || '').trim() || null) : await getCompanyId(supabase, userId);
  if (!companyId) return new Response(isCron ? 'companyId required' : 'Complete onboarding first', { status: 400 });

  const { data: task } = await supabase
    .from('tasks').select('id, title, assignee_id, project, status').eq('id', taskId).eq('company_id', companyId).maybeSingle();
  if (!task) return new Response('Task not found', { status: 404 });
  const employeeId = task.assignee_id;

  const { data: employee } = await supabase.from('employees').select('name, role, personality, bio').eq('id', employeeId).maybeSingle();
  const { data: company } = await supabase.from('companies').select('*').eq('id', companyId).maybeSingle();
  const { data: memory } = await supabase.from('memory_entries').select('type, title, content').eq('company_id', companyId).order('sort_order', { ascending: false }).limit(30);

  // ---- COMPED ACTIVATION RUN — the day-one "your team already went to work" moment.
  // The owner's FIRST run is on the house (never charge for activation). Valid only
  // when: caller asked for activation, onboarding is complete, and the company hasn't
  // been activated yet (companies.activated_at null). Exactly one comped run per company,
  // ever — the activate endpoint stamps activated_at right after, so it can't be replayed.
  const comped = body.activation === true && company?.onboarding_complete === true && !company?.activated_at;

  // Run scoping. Three modes, each with its own loop ceiling + lead target, all sized so the
  // run completes with real margin under the 300s ceiling:
  //   • activation — the comped day-one first run; ~10–12 leads (top-up refills over days).
  //   • topup      — the daily, charged drip; tightest of all, target passed by the cron
  //                  (a tapered DAILY_TOPUP_TARGET) so it tracks send capacity + hours.
  //   • manual     — an owner-triggered run; capped at ~15 leads/invocation (repeat-clickable,
  //                  dedupe-idempotent), NOT a 30–50 single shot (deferred queue/chunk work).
  const activationRun = body.activation === true;
  const topupRun = body.topup === true;
  const topupTarget = topupRun ? Math.max(1, Math.min(DAILY_TOPUP_TARGET, Math.round(body.target ?? DAILY_TOPUP_TARGET))) : 0;
  const maxIterations = activationRun ? ACTIVATION_MAX_ITERATIONS : topupRun ? TOPUP_MAX_ITERATIONS : MAX_ITERATIONS;
  const leadTarget = activationRun ? '10–12' : topupRun ? `${topupTarget}` : '12–15';
  const draftTopN = activationRun ? 5 : topupRun ? 4 : 5;
  // Deterministic lead-cap: stop researching once THIS run has produced enough leads, so a
  // lead-rich market can't blow the time budget by over-researching (we saw 18 leads / 360s
  // when only ~12 were wanted). The iteration ceiling bounds lead-poor markets; this bounds
  // lead-rich ones — together they keep wall-time predictable. Topup uses its tapered target.
  const leadCap = activationRun ? 12 : topupRun ? topupTarget : 15;

  // ---- HOURS GATE — checked BEFORE any API spend, charged on completion ------
  // A full prospecting cycle costs aria_run hours. We gate on the balance up front
  // (don't start work we can't afford) but DEBIT on completion, and charge ZERO for
  // a thin/failed run — the customer never pays for our misses. Running out is an
  // in-character overtime moment, not a raw error; the task stays runnable.
  const gate = comped ? { ok: true as const, message: '', balance: Infinity, estimate: 0 } : await gateWork(supabase, companyId, 'aria_run', employee?.name ?? employeeId);
  if (!gate.ok) {
    return Response.json(
      { ok: false, out_of_hours: true, message: gate.message, balance_hours: gate.balance, hours_needed: gate.estimate, created_this_run: { leads: 0, drafts: 0 } },
      { status: 402 }
    );
  }

  await supabase.from('tasks').update({ status: 'in_progress' }).eq('id', taskId).eq('company_id', companyId);

  // ===== ASYNC EXECUTION (ack now, research in the background) ==============
  // after() keeps this function alive up to maxDuration AFTER the response is flushed, so no
  // browser/serverless request hangs for minutes. The run persists leads/drafts incrementally
  // (callers poll for them), stamps activated_at itself on success, and releases the
  // activation claim on failure/timeout so the next load retries (the 90s stale-claim reclaim
  // in /api/onboard/activate is the backstop when a hard timeout kills us before this runs).
  after(async () => {
   const counters = { leads: 0, drafts: 0, dups: 0 }; // hoisted so the catch can report partial counts
   try {
    let persona = '';
    try { persona = await readFile(path.join(process.cwd(), 'personas', `${employeeId}.md`), 'utf8'); } catch { persona = ''; }
    const conversationId = await findOrCreateConversation(supabase, companyId, employeeId, `Run: ${task.title}`);

  const companyBlock = company
    ? `Company: ${company.company_name} | Industry: ${company.industry} | ICP: ${company.target_customers} | Tone: ${company.brand_tone}`
    : 'No company profile.';
  const memBlock = (memory ?? []).map((m) => `- [${m.type}] ${m.title}: ${m.content}`).join('\n') || 'none';

  // Who Aria prospects = THIS company's real ICP (from the brain), not a hardcoded
  // vertical. Prefer the saved ICP notes + the profile's target customers; fall back
  // to inferring from the profile if the brain has no ICP yet.
  const icpNotes = (memory ?? []).filter((m) => m.type === 'icp').map((m) => m.content).join(' | ');
  const targetBrief = [company?.target_customers, icpNotes].filter(Boolean).join(' — ')
    || 'No ICP saved yet — infer the most plausible fit from the company profile above, and say so in your report.';

  // Brand voice for the WRITER (Nova's lane in the brain) — same source as the SMS responder,
  // so outbound email reads on-brand and sharpens as the voice memory grows. Falls back to the
  // profile's brand_tone, then a safe human default.
  const brandVoice = company?.brand_tone
    || (memory ?? []).filter((m) => ['voice', 'brand'].includes(m.type)).map((m) => m.content).join(' | ')
    || 'warm, clear, human — confident without hype';

  // PROACTIVE DEDUPE (top-up only): hand Aria the businesses already in the pipeline so she
  // researches genuinely NEW ones instead of burning web searches re-finding them (the DB
  // unique index on (company, name, location) is the backstop; this avoids the wasted work).
  let dedupeBlock = '';
  if (topupRun) {
    const { data: existing } = await supabase
      .from('leads').select('business_name').eq('company_id', companyId).order('created_at', { ascending: false }).limit(300);
    const names = (existing ?? []).map((l) => (l.business_name as string)?.trim()).filter(Boolean);
    if (names.length) {
      dedupeBlock = `\n\nALREADY IN THE PIPELINE — do NOT re-add these; find genuinely NEW businesses (exact-name+location matches are auto-skipped, so re-listing them is wasted effort):\n${names.join(', ')}`;
    }
  }

  const system = injectPricing(`${persona || `You are ${employee?.name ?? employeeId}, ${employee?.role ?? ''}. ${employee?.bio ?? ''}`}

=====================================================================
LIVE COMPANY CONTEXT
${companyBlock}
COMPANY MEMORY:
${memBlock}

=====================================================================
EXECUTION MODE — you are now DOING the work, not just planning.
TASK: ${task.title}

RULES (binding):
1. REAL DATA ONLY. Find real businesses with web_search. Every create_lead needs a real source_url from your search results. NEVER invent a business or a number to hit a target — a real 22 beats a fabricated 40.
2. WHO TO TARGET — prospect REAL businesses that fit THIS company's ICP: ${targetBrief}
   Match their industry, customer type, and geography. If the TASK above names a specific segment, follow that.
3. GO DEEP — this is a PIPELINE build. Aim for ${leadTarget} real qualified leads in this run. Keep researching and scoring (vary your searches across sub-segments, neighborhoods/cities, and adjacent terms) until you reach the target OR the search is genuinely exhausted — then say which it was in your report. Score each 0-100 with the rubric (ICP fit /40, pain /30, ability /20, reachability /10), each part with a one-line reason. If COMPANY MEMORY includes a "Lead-scoring tilt", apply it — shift weight toward the urgency/signals it names (e.g. an active emergency scores top; a no-date "someday" scores low → nurture).
4. Two different numbers — never conflate them: LEADS RESEARCHED is what you scale here (aim high). EMAILS SENT is separately capped by warmup + CAN-SPAM and is the OWNER's call after approval. Your job this run is the deep scored pipeline, not sending.
5. You do NOT write emails — focus entirely on research + scoring. The system AUTOMATICALLY drafts outreach for the TOP ${draftTopN} leads by score the moment you finish (pending the owner's approval — nothing is sent). So spend every step finding and scoring real leads.
6. Lead Lifeline: every lead must have a next_action + next_action_at.
7. Log_activity as you go. When done, call report ONCE with real counts (how many researched, how many leads created, whether you hit the target or exhausted the search, top names+scores), then STOP.
8. EFFICIENCY — you have a limited number of steps but can create MANY leads per step: batch several create_lead calls in one turn after each round of searches. Do a round of searches, create all those leads at once, then search a new sub-segment — don't re-research the same businesses or fire many web searches back-to-back in a single step.${topupRun ? `
9. TOP-UP MODE — this is a DAILY top-up, not the first run. The pipeline already has leads; find only NEW businesses (~${topupTarget} fresh, real ones). Duplicates are auto-skipped, so don't pad with ones likely already added. If the local ICP/geo is genuinely tapped (you keep surfacing the same businesses), STOP EARLY and say so in your report — we'll widen the radius or move to the next segment. A small batch of genuinely new leads beats re-listing the market.${dedupeBlock}` : ''}`);

  // Writer system prompt: same persona/company context, focused purely on writing.
  const writingSystem = injectPricing(`${persona || `You are ${employee?.name ?? employeeId}.`}

=====================================================================
LIVE COMPANY CONTEXT
${companyBlock}
COMPANY MEMORY:
${memBlock}

BRAND VOICE — write in THIS voice (it's the customer's, not ours): ${brandVoice}

=====================================================================
You write ONE best-in-class prospect-facing cold email. This email IS our portfolio — it must read like a sharp human SDR wrote it, never a template. Output ONLY through the emit_email tool.

SUBJECT (one line):
- Specific and lowercase-ish, like a real person typed it. Reference the real researched fact or their world.
- NEVER ALL-CAPS, never "FREE", no "!!!", no $ amounts, no clickbait. A spammy subject kills the whole email.

BODY — keep it UNDER ~120 words, in this structure, each part its own short paragraph separated by a BLANK LINE (so it renders as real paragraphs, not a wall of text):
1. PERSONALIZED FIRST LINE — open with the specific, real thing you researched about THEM (their business, city, a signal). No "Hi, I hope this finds you well." Earn the next line.
2. THE LEAK / PAIN — name the concrete gap you can credibly fix (for advertisers: leads going cold after the click; otherwise the relevant speed-to-lead / follow-up gap). Be honest about what you can and can't see.
3. THE OFFER — Surge is ONE done-for-you AI sales team (the ${OFFER_NAME}) — NOT a menu of individual "AI employees" or per-seat plans. DO NOT LEAD WITH PRICE in a cold email: sell the OUTCOME — more booked jobs from the customers they already have, every new lead answered in minutes — and make the ask a 15-minute look, never a checkout. If price surfaces at all: ${FOUNDING_LABEL}/mo founding rate, and ${PRICE_GATE} Never quote per-employee, per-seat, or any old plan pricing. You book qualified meetings; you never "close deals".
4. ONE CLEAR ASK — a single CTA line containing the literal placeholder {{CTA_URL}} exactly once (e.g. "If that's worth 15 minutes, grab a time here: {{CTA_URL}}"). No other link, no second ask.

After the body, the system appends the signature automatically — do NOT write a sign-off or signature yourself.

P.S. VARIANT: the per-email instruction tells you whether to add a transparent-AI P.S. If told to INCLUDE it, add ONE short, confident, cheeky line owning that you're an AI (e.g. "An AI wrote this. You read the whole thing anyway. That's what I'd do for every lead you get."). If told to OMIT it, end at the last body line.

HARD RULES: Never fabricate stats, customers, or claims you can't back. For an "Active-advertiser signal" you can see THAT they advertise and HOW LONG, but NEVER claim to know their conversion or ROI — pitch only the post-click follow-up gap. No buzzwords, no "just following up", no walls of text.`);

  const client = new Anthropic();

  // ---- Cost telemetry -------------------------------------------------------
  // One usage_log row per Anthropic call; summed for the run. Recorded from the
  // real usage object every response carries — never estimated from guesses.
  const runId = randomUUID();
  const cost = { usd: 0 };
  async function recordUsage(model: string, usage: Anthropic.Usage | null | undefined) {
    if (!usage) return;
    const inputTokens = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
    const cacheReadTokens = usage.cache_read_input_tokens ?? 0;
    const outputTokens = usage.output_tokens ?? 0;
    const webSearches = usage.server_tool_use?.web_search_requests ?? 0;
    const est = estCostUsd({ model, input_tokens: inputTokens, cache_read_tokens: cacheReadTokens, output_tokens: outputTokens, web_searches: webSearches });
    cost.usd = +(cost.usd + est).toFixed(5);
    await supabase.from('usage_log').insert({
      company_id: companyId!, employee_id: employeeId, task_id: taskId, run_id: runId,
      model, input_tokens: inputTokens, cache_read_tokens: cacheReadTokens, output_tokens: outputTokens,
      web_searches: webSearches, est_cost_usd: est,
    });
  }

  // Writer: produce ONE cold email on the WRITING_MODEL (Sonnet). Cost recorded.
  async function writeColdEmail(lead: LeadRow): Promise<{ subject: string; body: string; variant: string }> {
    const l = lead as Record<string, unknown>;
    const adSignal = (l.relationship as string)?.trim() || '';
    // The transparent-AI P.S. ("an AI wrote this…") is SURGE'S OWN marketing voice — confident
    // and cheeky about being an AI. That belongs ONLY on Surge's own outbound prospecting. A
    // paying customer's Aria emailing THEIR leads must NEVER ship under that line: it's written
    // in the customer's brand voice (see writingSystem above — "it's the customer's, not ours"),
    // and "an AI wrote this" would be off-brand, even damaging, for them. So only Surge's own
    // internal account (companies.is_internal) A/B-tests the P.S.; every customer run forces
    // 'no_ps'. Fail-closed: a null/unknown company never gets the P.S.
    const internalOutreach = company?.is_internal === true;
    const variant = internalOutreach && Math.random() < 0.5 ? 'ps' : 'no_ps';
    const psInstruction = variant === 'ps'
      ? 'INCLUDE the transparent-AI P.S. — one short, confident, cheeky line owning that you are an AI (e.g. "An AI wrote this. You read the whole thing anyway. That\'s what I\'d do for every lead you get.").'
      : 'Do NOT include any P.S. — end at the last body line.';
    const facts = `Lead: ${l.business_name} (${l.vertical}${l.location ? `, ${l.location}` : ''})
Website: ${l.website ?? 'n/a'} | Contact: ${l.contact_name ?? 'unknown'} ${l.contact_role ?? ''}
Why qualified (rubric): ${JSON.stringify(l.score_reasons ?? {})}
Notes: ${l.notes ?? 'none'}
Active-advertiser signal: ${adSignal || 'none (not a verified advertiser)'}`;
    const emit: Anthropic.Tool = {
      name: 'emit_email',
      description: 'Return the finished cold email.',
      input_schema: { type: 'object', properties: { subject: { type: 'string' }, body: { type: 'string' } }, required: ['subject', 'body'] },
    };
    const resp = await client.messages.create({
      model: WRITING_MODEL,
      max_tokens: 700,
      system: [{ type: 'text', text: writingSystem, cache_control: { type: 'ephemeral' } }],
      tools: [emit],
      tool_choice: { type: 'tool', name: 'emit_email' },
      messages: [{ role: 'user', content: `Write ONE first-touch cold email for this lead, under ~120 words, in the structure from your instructions.\n\nP.S. VARIANT: ${psInstruction}\n\n${facts}` }],
    });
    await recordUsage(WRITING_MODEL, resp.usage);
    const block = resp.content.find((b) => b.type === 'tool_use') as Anthropic.ToolUseBlock | undefined;
    const out = (block?.input ?? {}) as { subject?: string; body?: string };
    return { subject: (out.subject ?? '').trim(), body: (out.body ?? '').trim(), variant };
  }

  const ctx: ToolCtx = { companyId, employeeId, conversationId, counters, writeColdEmail };
  const convo: Anthropic.MessageParam[] = [{ role: 'user', content: 'Begin the prospecting run now.' }];
  let reported = false;
  const runStartedAt = new Date().toISOString(); // to scope post-loop drafting to THIS run's leads
  // Wall-clock research budget — the REAL guarantee the run fits the serverless ceiling no
  // matter how slow individual web searches are (they vary ~27–47s/iter, so an iteration count
  // alone can't bound time). Reserve ~110s for one trailing iteration + parallel drafting +
  // completion. On Pro (MAX_RUN_SECONDS=300) → ~190s of research; the iteration ceiling + leadCap
  // are now just backstops. (Dev defaults to 60 → set MAX_RUN_SECONDS=300 locally to mirror Pro.)
  // Wall-clock research budget matched to the 300s maxDuration: reserve ~110s for the trailing
  // iteration + parallel drafting + completion → ~190s of research. This is the real guarantee
  // the run finishes under 300s regardless of per-iteration web-search variance (~27–47s).
  const researchDeadlineMs = Date.now() + 190 * 1000;

  for (let i = 0; i < maxIterations; i++) {
      if (Date.now() > researchDeadlineMs) break; // time budget spent — stop researching, go draft
      const resp = await client.messages.create({
        model: RESEARCH_MODEL,
        max_tokens: 8192, // room for a big batch of create_lead calls in one turn (see max_tokens handling below)
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        tools,
        messages: convo,
      });
      await recordUsage(RESEARCH_MODEL, resp.usage);
      convo.push({ role: 'assistant', content: resp.content });

      // pause_turn = a server tool (web_search) hit its per-turn iteration limit.
      // claude models reject a trailing assistant message (no prefill), so we
      // continue with a user message instead of re-sending the assistant turn.
      if (resp.stop_reason === 'pause_turn') {
        convo.push({ role: 'user', content: 'Continue.' });
        continue;
      }

      // tool_use → execute the tools. max_tokens WITH tool calls means the model batched so
      // many calls (e.g. a dozen create_leads) that the response truncated mid-stream — still
      // execute every complete block (the last may be partial → executeTool returns a harmless
      // error result) and continue, so a big batch of leads is NEVER silently dropped. (Before
      // this, a truncated create_lead batch fell through to `break` and wrote zero leads.)
      const hasToolUse = resp.content.some((b) => b.type === 'tool_use');
      if (resp.stop_reason === 'tool_use' || (resp.stop_reason === 'max_tokens' && hasToolUse)) {
        const toolBlocks = resp.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
        if (toolBlocks.some((b) => b.name === 'report')) reported = true;
        // Execute a turn's tool calls CONCURRENTLY (bounded) — e.g. a batch of create_lead
        // inserts in one turn run in parallel rather than one-by-one. (Drafting is no longer a
        // loop tool; it runs in a single parallel batch AFTER the loop — see below.)
        const results: Anthropic.ToolResultBlockParam[] = await mapBounded(toolBlocks, DRAFT_CONCURRENCY, async (block) => ({
          type: 'tool_result',
          tool_use_id: block.id,
          content: await executeTool(block.name, block.input as Record<string, unknown>, supabase, ctx),
        }));
        // Tool results MUST go back as a user message — never a trailing assistant.
        if (results.length === 0) break; // nothing to send back → stop, don't re-send a prefill
        convo.push({ role: 'user', content: results });
        if (reported) break;
        if (counters.leads >= leadCap) break; // enough leads — stop researching, go draft (time bound)
        continue;
      }
      break; // end_turn — convo ends with assistant, but we exit the loop (never re-sent)
    }

    // ===== DETERMINISTIC POST-LOOP DRAFTING ==================================
    // The agent only researched + scored. Now draft outreach for the TOP draftTopN leads
    // FROM THIS RUN, in ONE bounded-parallel batch — reusing executeTool's 'draft_email'
    // (same writing model, persona, tracked-CTA, pending-approval insert). This replaces the
    // model emitting draft_email one-per-turn (~30–40s serial each), the wall-time killer:
    // draftTopN Sonnet writes now overlap instead of stacking. Scoped to runStartedAt so a
    // manual/top-up run drafts only the leads IT created, never re-drafting older ones.
    const { data: topLeads } = await supabase
      .from('leads').select('id, score')
      .eq('company_id', companyId)
      .gte('created_at', runStartedAt)
      .order('score', { ascending: false })
      .limit(draftTopN);
    await mapBounded(topLeads ?? [], DRAFT_CONCURRENCY, (lead) =>
      executeTool('draft_email', { lead_id: (lead as { id: string }).id }, supabase, ctx));

    await supabase.from('tasks').update({ status: 'completed' }).eq('id', taskId).eq('company_id', companyId);

    // Charge hours on completion. A THIN run (produced no leads) costs ZERO — the
    // customer never pays for our misses. Otherwise debit the estimated cost.
    const thin = counters.leads === 0;
    const charged = (thin || comped) ? 0 : estimateHours('aria_run'); // activation run is on the house
    await debitHours(supabase, companyId, charged, `${employee?.name ?? employeeId} task run`, { employeeId, refType: 'task', refId: taskId });
    // Surface the time worked in the activity feed (real hours, real work).
    if (charged > 0) {
      await supabase.from('activity_log').insert({
        id: 'a' + Date.now() + Math.floor(Math.random() * 1000),
        company_id: companyId, employee_id: employeeId,
        action: `Prospecting run — ${counters.leads} leads, ${formatHours(charged)} of time`,
        detail: null, timestamp: 'just now', sort_order: Date.now(),
      });
    }

    // Market-tapped upsell (top-up only): if a top-up came back mostly duplicates and
    // well under target, the local ICP/geo is likely exhausted — surface widening the
    // radius instead of silently churning. Deterministic id = at most one nudge per day.
    if (topupRun && counters.dups > 0 && counters.leads < topupTarget / 2) {
      await supabase.from('activity_log').insert({
        id: `topup-exhaust-${companyId}-${todayISO()}`,
        company_id: companyId, employee_id: employeeId,
        action: `I've likely covered the available ${company?.industry ?? 'local'} prospects for now — want me to widen the radius or move to the next segment?`,
        detail: null, timestamp: 'just now', sort_order: Date.now(),
      }).then(() => {}, () => {}); // ignore the dup-id collision if already logged today
    }

    // Day-one activation: the RUN itself stamps activated_at, and ONLY here on the success
    // path — so a killed/timed-out run never marks the company activated (and the next load
    // retries). Guard on still-null so we never overwrite an earlier stamp.
    if (activationRun) {
      await supabase.from('companies').update({ activated_at: new Date().toISOString() }).is('activated_at', null).eq('id', companyId);
    }
   } catch (err) {
    // Log to the server (Vercel function logs) AND Sentry — a swallowed run failure (e.g. an
    // Anthropic 400/credit error, a timeout) must be visible, not a silently flat pipeline.
    console.error('[agent/run] background run failed:', err instanceof Error ? err.message : err);
    // Sentry capture (no-op unless DSN is set in prod).
    Sentry.captureException(err, {
      tags: { route: 'agent/run', activation: String(activationRun), topup: String(topupRun) },
      extra: { taskId, companyId, leadsThisRun: counters.leads, draftsThisRun: counters.drafts },
    });
    // Failed run: charge NOTHING. For an ACTIVATION run, RELEASE the claim so the next
    // dashboard load retries instead of bailing on a stuck claim (the 90s stale-claim
    // reclaim is the backstop if a hard timeout kills us before this runs). Manual/top-up
    // tasks stay in_progress and are simply re-runnable (idempotent via dedupe).
    if (activationRun) {
      await supabase.from('tasks').delete().eq('id', taskId).eq('company_id', companyId).then(() => {}, () => {});
    }
   }
  });

  // Ack immediately; the loop above runs in the background (after) within maxDuration. The
  // caller polls activation status / lead counts as rows are written — no all-or-nothing wait.
  return Response.json({ ok: true, accepted: true, taskId, activating: activationRun });
}
