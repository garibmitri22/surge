import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createSupabaseServerClient } from '@/lib/supabase-server';

const MODEL = 'claude-sonnet-4-6';
const MAX_ITERATIONS = 18;

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
      'Write a cold-email draft for a lead (saved as pending approval — NOTHING is sent). Use the lead_id returned by create_lead. Under 100 words, personalized first line, one ask. Pitch Surge: $299/mo AI employee vs $50K human; Aria "books qualified meetings" (never "closes deals"); no fabricated trust claims or customer counts.',
    input_schema: {
      type: 'object',
      properties: {
        lead_id: { type: 'string' },
        sequence_step: { type: 'integer' },
        subject: { type: 'string' },
        body: { type: 'string' },
      },
      required: ['lead_id', 'subject', 'body'],
    },
  },
  {
    name: 'log_activity',
    description: 'Record a short activity-feed entry as you work (e.g. "Researched 14 med spas in Conroe").',
    input_schema: { type: 'object', properties: { action: { type: 'string' }, detail: { type: 'string' } }, required: ['action'] },
  },
  {
    name: 'report',
    description: 'Post a final summary message to the owner with REAL counts from the work you did. Call this once at the end, then stop.',
    input_schema: { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'] },
  },
];

function todayISO() { return new Date().toISOString().split('T')[0]; }

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  supabase: SupabaseServer,
  ctx: { companyId: string; employeeId: string; conversationId: string; counters: { leads: number; drafts: number } }
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
    const { error } = await supabase.from('lead_drafts').insert({
      lead_id: leadId,
      company_id: companyId,
      channel: 'email',
      sequence_step: typeof input.sequence_step === 'number' ? input.sequence_step : 1,
      subject: String(input.subject ?? ''),
      body: String(input.body ?? ''),
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

  let persona = '';
  try { persona = await readFile(path.join(process.cwd(), 'personas', `${employeeId}.md`), 'utf8'); } catch { persona = ''; }

  await supabase.from('tasks').update({ status: 'in_progress' }).eq('id', taskId).eq('company_id', companyId);
  const conversationId = await findOrCreateConversation(supabase, companyId, employeeId, `Run: ${task.title}`);

  const companyBlock = company
    ? `Company: ${company.company_name} | Industry: ${company.industry} | ICP: ${company.target_customers} | Tone: ${company.brand_tone}`
    : 'No company profile.';
  const memBlock = (memory ?? []).map((m) => `- [${m.type}] ${m.title}: ${m.content}`).join('\n') || 'none';

  const system = `${persona || `You are ${employee?.name ?? employeeId}, ${employee?.role ?? ''}. ${employee?.bio ?? ''}`}

=====================================================================
LIVE COMPANY CONTEXT
${companyBlock}
COMPANY MEMORY:
${memBlock}

=====================================================================
EXECUTION MODE — you are now DOING the work, not just planning.
TASK: ${task.title}

RULES (binding):
1. REAL DATA ONLY. Find real businesses with web_search. Every create_lead needs a real source_url from your search results. If you only find 8 qualified leads, create 8 — never invent.
2. THIS RUN: focus on MED SPAS in North Houston up to Conroe. Aim for ~10-15 real qualified leads. Score each 0-100 with the rubric (ICP fit /40, pain /30, ability /20, reachability /10), each part with a one-line reason.
3. After scoring, draft cold emails (draft_email) for the TOP 5 by score. Drafts are pending approval — you send NOTHING.
4. Lead Lifeline: every lead must have a next_action + next_action_at.
5. Log_activity as you go. When done, call report ONCE with real counts (how many researched, how many leads created, top 5 names+scores), then STOP.
6. Be efficient — you have a limited number of steps. Don't re-research the same businesses. Work incrementally: do a few searches, create those leads, then search more — don't fire many web searches back-to-back in a single step.`;

  const client = new Anthropic();
  const counters = { leads: 0, drafts: 0 };
  const convo: Anthropic.MessageParam[] = [{ role: 'user', content: 'Begin the prospecting run now.' }];
  let reported = false;
  let lastText = '';

  try {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const resp = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        tools,
        messages: convo,
      });
      convo.push({ role: 'assistant', content: resp.content });
      lastText = resp.content.filter((b) => b.type === 'text').map((b) => (b as Anthropic.TextBlock).text).join('') || lastText;

      // pause_turn = a server tool (web_search) hit its per-turn iteration limit.
      // claude-sonnet-4-6 rejects a trailing assistant message (no prefill), so we
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
            const out = await executeTool(block.name, block.input as Record<string, unknown>, supabase, {
              companyId, employeeId, conversationId, counters,
            });
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

    return Response.json({
      ok: true,
      taskId,
      created_this_run: counters,
      pipeline_totals: { leads: leadCount ?? 0, drafts: draftCount ?? 0 },
      reported,
      message: lastText.slice(0, 2000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Run failed';
    // Leave task in_progress so it can be re-run (idempotent via dedupe).
    return Response.json({ ok: false, error: msg, created_this_run: counters }, { status: 500 });
  }
}
