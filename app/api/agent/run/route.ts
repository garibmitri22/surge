import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { estCostUsd, RESEARCH_MODEL, WRITING_MODEL } from '@/lib/usage-config.mjs';
import { injectPricing, PRICE_SINGLE, PRICE_TEAM, PRICE_HUMAN_ANCHOR, estimateHours, formatHours } from '@/lib/pricing.mjs';
import { gateWork, debitHours } from '@/lib/hours.mjs';
import { trackedLinkUrl } from '@/lib/sign.mjs';
import { embedTrackedCta } from '@/lib/email.mjs';

// Deeper research: the wedge is a BIG scored pipeline (30–50+ leads/run), not more
// sends. The model fires many create_lead calls per turn (parallel tool use), so a
// 30-step ceiling is ample headroom to research, score, and draft without inventing.
const MAX_ITERATIONS = 30;

type SupabaseServer = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function getCompanyId(supabase: SupabaseServer): Promise<string | null> {
  const { data } = await supabase.from('companies').select('id').order('completed_at', { ascending: false }).limit(1).maybeSingle();
  return data?.id ?? null;
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
        next_action: { type: 'string', description: 'The next concrete step for this lead (Lead Lifeline law)' },
        next_action_at: { type: 'string', description: 'When the next step is due (YYYY-MM-DD)' },
        notes: { type: 'string' },
      },
      required: ['business_name', 'vertical', 'source_url', 'score', 'score_reasons', 'next_action', 'next_action_at'],
    },
  },
  {
    name: 'draft_email',
    description:
      'Draft a cold email for a lead (saved as pending approval — NOTHING is sent). Pass the lead_id returned by create_lead; the finished copy is authored by the senior writer (subject/body you pass are optional hints only). Use this for the TOP leads by score.',
    input_schema: {
      type: 'object',
      properties: {
        lead_id: { type: 'string' },
        sequence_step: { type: 'integer' },
        subject: { type: 'string', description: 'Optional hint — the writer produces the final subject' },
        body: { type: 'string', description: 'Optional hint — the writer produces the final body' },
      },
      required: ['lead_id'],
    },
  },
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
  counters: { leads: number; drafts: number };
  // Writes the final prospect-facing email on the WRITING_MODEL (Sonnet), records its cost.
  writeColdEmail: (lead: LeadRow) => Promise<{ subject: string; body: string }>;
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
      if (error.code === '23505') return `Skipped duplicate: "${row.business_name}" is already in the pipeline.`;
      return `ERROR creating lead: ${error.message}`;
    }
    counters.leads++;
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
    try {
      const written = await ctx.writeColdEmail(lead as LeadRow);
      if (written.subject && written.body) { subject = written.subject; body = written.body; }
    } catch {
      // Sonnet write failed — fall back to any hint the orchestrator supplied.
    }
    if (!subject || !body) return 'ERROR: could not produce email subject/body.';

    // Embed the ONE signed, per-lead tracked CTA link (the warm signal). The writer
    // leaves a {{CTA_URL}} placeholder; we swap in the real link (or append one).
    try { body = embedTrackedCta(body, trackedLinkUrl(leadId, companyId)); } catch { /* secret missing — leave copy as-is */ }

    const { error } = await supabase.from('lead_drafts').insert({
      lead_id: leadId,
      company_id: companyId,
      channel: 'email',
      sequence_step: typeof input.sequence_step === 'number' ? input.sequence_step : 1,
      subject,
      body,
      approval_status: 'pending',
    });
    if (error) return `ERROR creating draft: ${error.message}`;
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

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  let body: { taskId?: string };
  try { body = await request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }
  const taskId = (body.taskId || '').trim();
  if (!taskId) return new Response('taskId required', { status: 400 });

  const companyId = await getCompanyId(supabase);
  if (!companyId) return new Response('Complete onboarding first', { status: 400 });

  const { data: task } = await supabase
    .from('tasks').select('id, title, assignee_id, project, status').eq('id', taskId).eq('company_id', companyId).maybeSingle();
  if (!task) return new Response('Task not found', { status: 404 });
  const employeeId = task.assignee_id;

  const { data: employee } = await supabase.from('employees').select('name, role, personality, bio').eq('id', employeeId).maybeSingle();
  const { data: company } = await supabase.from('companies').select('*').eq('id', companyId).maybeSingle();
  const { data: memory } = await supabase.from('memory_entries').select('type, title, content').eq('company_id', companyId).order('sort_order', { ascending: false }).limit(30);

  // ---- HOURS GATE — checked BEFORE any API spend, charged on completion ------
  // A full prospecting cycle costs aria_run hours. We gate on the balance up front
  // (don't start work we can't afford) but DEBIT on completion, and charge ZERO for
  // a thin/failed run — the customer never pays for our misses. Running out is an
  // in-character overtime moment, not a raw error; the task stays runnable.
  const gate = await gateWork(supabase, companyId, 'aria_run', employee?.name ?? employeeId);
  if (!gate.ok) {
    return Response.json(
      { ok: false, out_of_hours: true, message: gate.message, balance_hours: gate.balance, hours_needed: gate.estimate, created_this_run: { leads: 0, drafts: 0 } },
      { status: 402 }
    );
  }

  let persona = '';
  try { persona = await readFile(path.join(process.cwd(), 'personas', `${employeeId}.md`), 'utf8'); } catch { persona = ''; }

  await supabase.from('tasks').update({ status: 'in_progress' }).eq('id', taskId).eq('company_id', companyId);
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
3. GO DEEP — this is a PIPELINE build. Aim for 30–50+ real qualified leads in this run. Keep researching and scoring (vary your searches across sub-segments, neighborhoods/cities, and adjacent terms) until you reach the target OR the search is genuinely exhausted — then say which it was in your report. Score each 0-100 with the rubric (ICP fit /40, pain /30, ability /20, reachability /10), each part with a one-line reason.
4. Two different numbers — never conflate them: LEADS RESEARCHED is what you scale here (aim high). EMAILS SENT is separately capped by warmup + CAN-SPAM and is the OWNER's call after approval. Your job this run is the deep scored pipeline + drafts, not sending.
5. After scoring, draft cold emails (draft_email) for the TOP 8 by score — just pass each lead_id; the senior writer produces the final copy with the booking CTA baked in. Drafts are pending approval — you send NOTHING.
6. Lead Lifeline: every lead must have a next_action + next_action_at.
7. Log_activity as you go. When done, call report ONCE with real counts (how many researched, how many leads created, whether you hit the target or exhausted the search, top names+scores), then STOP.
8. EFFICIENCY — you have a limited number of steps but can create MANY leads per step: batch several create_lead calls in one turn after each round of searches. Do a round of searches, create all those leads at once, then search a new sub-segment — don't re-research the same businesses or fire many web searches back-to-back in a single step.`);

  // Writer system prompt: same persona/company context, focused purely on writing.
  const writingSystem = injectPricing(`${persona || `You are ${employee?.name ?? employeeId}.`}

=====================================================================
LIVE COMPANY CONTEXT
${companyBlock}
COMPANY MEMORY:
${memBlock}

You are writing prospect-facing cold email copy. Apply your full Writing Discipline (under 100 words, a specific personalized first line, one small ask, no buzzwords, no "just following up"). The ONE call-to-action must be a booking link: end with a short CTA line that contains the literal placeholder {{CTA_URL}} exactly once (e.g. "If that's worth 15 minutes, grab a time here: {{CTA_URL}}"). Do not write any other link. Output ONLY through the emit_email tool. Never fabricate stats, customers, or claims you can't back.`);

  const client = new Anthropic();
  const counters = { leads: 0, drafts: 0 };

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
  async function writeColdEmail(lead: LeadRow): Promise<{ subject: string; body: string }> {
    const l = lead as Record<string, unknown>;
    const facts = `Lead: ${l.business_name} (${l.vertical}${l.location ? `, ${l.location}` : ''})
Website: ${l.website ?? 'n/a'} | Contact: ${l.contact_name ?? 'unknown'} ${l.contact_role ?? ''}
Why qualified (rubric): ${JSON.stringify(l.score_reasons ?? {})}
Notes: ${l.notes ?? 'none'}`;
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
      messages: [{ role: 'user', content: `Write ONE first-touch cold email for this lead. Pitch Surge ($${PRICE_SINGLE}/mo AI employee, or the full team at $${PRICE_TEAM}/mo run by a Chief of Staff, vs a ${PRICE_HUMAN_ANCHOR} human; you book qualified meetings, never "close deals").\n\n${facts}` }],
    });
    await recordUsage(WRITING_MODEL, resp.usage);
    const block = resp.content.find((b) => b.type === 'tool_use') as Anthropic.ToolUseBlock | undefined;
    const out = (block?.input ?? {}) as { subject?: string; body?: string };
    return { subject: (out.subject ?? '').trim(), body: (out.body ?? '').trim() };
  }

  const ctx: ToolCtx = { companyId, employeeId, conversationId, counters, writeColdEmail };
  const convo: Anthropic.MessageParam[] = [{ role: 'user', content: 'Begin the prospecting run now.' }];
  let reported = false;
  let lastText = '';

  try {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const resp = await client.messages.create({
        model: RESEARCH_MODEL,
        max_tokens: 4096,
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        tools,
        messages: convo,
      });
      await recordUsage(RESEARCH_MODEL, resp.usage);
      convo.push({ role: 'assistant', content: resp.content });
      lastText = resp.content.filter((b) => b.type === 'text').map((b) => (b as Anthropic.TextBlock).text).join('') || lastText;

      // pause_turn = a server tool (web_search) hit its per-turn iteration limit.
      // claude models reject a trailing assistant message (no prefill), so we
      // continue with a user message instead of re-sending the assistant turn.
      if (resp.stop_reason === 'pause_turn') {
        convo.push({ role: 'user', content: 'Continue.' });
        continue;
      }

      if (resp.stop_reason === 'tool_use') {
        const results: Anthropic.ToolResultBlockParam[] = [];
        for (const block of resp.content) {
          if (block.type === 'tool_use') {
            if (block.name === 'report') reported = true;
            const out = await executeTool(block.name, block.input as Record<string, unknown>, supabase, ctx);
            results.push({ type: 'tool_result', tool_use_id: block.id, content: out });
          }
        }
        // Tool results MUST go back as a user message — never a trailing assistant.
        if (results.length === 0) break; // nothing to send back → stop, don't re-send a prefill
        convo.push({ role: 'user', content: results });
        if (reported) break;
        continue;
      }
      break; // end_turn — convo ends with assistant, but we exit the loop (never re-sent)
    }

    // Real counts from the DB (source of truth, not the model's claims).
    const { count: leadCount } = await supabase.from('leads').select('id', { count: 'exact', head: true }).eq('company_id', companyId);
    const { count: draftCount } = await supabase.from('lead_drafts').select('id', { count: 'exact', head: true }).eq('company_id', companyId);

    await supabase.from('tasks').update({ status: 'completed' }).eq('id', taskId).eq('company_id', companyId);

    // Charge hours on completion. A THIN run (produced no leads) costs ZERO — the
    // customer never pays for our misses. Otherwise debit the estimated cost.
    const thin = counters.leads === 0;
    const charged = thin ? 0 : estimateHours('aria_run');
    const balanceAfter = await debitHours(supabase, companyId, charged, `${employee?.name ?? employeeId} task run`, { employeeId, refType: 'task', refId: taskId });
    // Surface the time worked in the activity feed (real hours, real work).
    if (charged > 0) {
      await supabase.from('activity_log').insert({
        id: 'a' + Date.now() + Math.floor(Math.random() * 1000),
        company_id: companyId, employee_id: employeeId,
        action: `Prospecting run — ${counters.leads} leads, ${formatHours(charged)} of time`,
        detail: null, timestamp: 'just now', sort_order: Date.now(),
      });
    }

    return Response.json({
      ok: true,
      taskId,
      created_this_run: counters,
      pipeline_totals: { leads: leadCount ?? 0, drafts: draftCount ?? 0 },
      hours: { charged, balance: balanceAfter, thin },
      usage: { est_cost_usd: cost.usd },
      reported,
      message: lastText.slice(0, 2000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Run failed';
    // Failed run: charge NOTHING (no debit) and leave the task in_progress so it can
    // be re-run (idempotent via dedupe). The customer never pays for our misses.
    return Response.json({ ok: false, error: msg, created_this_run: counters, hours: { charged: 0 }, usage: { est_cost_usd: cost.usd } }, { status: 500 });
  }
}
