import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { buildSystemPrompt, toolsFor, isRequiredSetMet, PROFILE_MEMORY_TYPES } from '@/lib/chat-prompt.mjs';

const MODEL = 'claude-sonnet-4-6';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SupabaseServer = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// Ordered by created_at so a not-yet-complete DRAFT row (Atlas intake writes to it
// as it goes) is found too — completed_at is null on a draft.
async function getCompanyId(supabase: SupabaseServer): Promise<string | null> {
  const { data } = await supabase
    .from('companies')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

// Onboarding v2: intake needs a company row to write to BEFORE onboarding is
// complete. Reuse the user's existing row (draft or completed) or create a fresh
// draft. onboarding_complete stays false until complete_onboarding flips it.
async function getOrCreateDraftCompany(supabase: SupabaseServer, userId: string): Promise<string | null> {
  const existing = await getCompanyId(supabase);
  if (existing) return existing;
  const { data, error } = await supabase
    .from('companies')
    .insert({ user_id: userId, onboarding_complete: false })
    .select('id')
    .single();
  if (error || !data) return null;
  return data.id;
}

async function loadPersona(employeeId: string): Promise<string | null> {
  try {
    const file = path.join(process.cwd(), 'personas', `${employeeId}.md`);
    return await readFile(file, 'utf8');
  } catch {
    return null;
  }
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// Tools — defined in lib/chat-prompt.mjs (shared with scripts/verify-chat-prompt.mjs
// so the live verification can never drift from production). toolsFor() adds the
// intake-only tools (save_company_profile / complete_onboarding) during onboarding.
// ---------------------------------------------------------------------------

// Memory kinds remember_detail may persist. Intake kinds (icp/offer/...) are the
// personalization contract every employee reads; the rest are Atlas's working
// memory. Anything unknown falls back to a general note.
const MEMORY_KINDS = [
  'decision', 'open-loop', 'idea', 'rapport', 'note',
  'icp', 'offer', 'proof', 'voice', 'goal', 'brand-kit', 'process',
];
// PROFILE_MEMORY_TYPES (singleton-per-company) is shared from chat-prompt.mjs.

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  supabase: SupabaseServer,
  companyId: string,
  employeeId: string,
  intakeMode: boolean
): Promise<string> {
  const now = Date.now();
  // ---- Intake-only tools (guarded: ignored outside onboarding) --------------
  if (name === 'save_company_profile' || name === 'complete_onboarding') {
    if (!intakeMode) return `Unavailable: ${name} is only callable during onboarding.`;

    if (name === 'save_company_profile') {
      // Persist only the fields actually confirmed this turn — partial updates are fine.
      const fields: {
        company_name?: string; industry?: string; target_customers?: string;
        brand_tone?: string; main_goal?: string; competitors?: string; employee_count?: string;
      } = {};
      const clean = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
      if (clean(input.company_name)) fields.company_name = clean(input.company_name);
      if (clean(input.industry)) fields.industry = clean(input.industry);
      if (clean(input.target_customers)) fields.target_customers = clean(input.target_customers);
      if (clean(input.brand_tone)) fields.brand_tone = clean(input.brand_tone);
      if (clean(input.main_goal)) fields.main_goal = clean(input.main_goal);
      if (clean(input.competitors)) fields.competitors = clean(input.competitors);
      if (clean(input.employee_count)) fields.employee_count = clean(input.employee_count);
      const keys = Object.keys(fields);
      if (keys.length === 0) return 'Nothing to save — no confirmed fields provided.';
      const { error } = await supabase.from('companies').update(fields).eq('id', companyId);
      if (error) return `ERROR saving company profile: ${error.message}`;
      return `Saved company profile fields: ${keys.join(', ')}.`;
    }

    // complete_onboarding — SERVER-GATED. The required set (icp/offer/voice/goal)
    // must already exist as memory_entries; we re-check here so an early/optimistic
    // model call can't finish onboarding before the brain is actually populated.
    const { data: memRows } = await supabase
      .from('memory_entries')
      .select('type')
      .eq('company_id', companyId);
    const presentTypes = (memRows ?? []).map((m: { type: string }) => m.type);
    if (!isRequiredSetMet(presentTypes)) {
      const missing = ['icp', 'offer', 'voice', 'goal'].filter((t) => !presentTypes.includes(t));
      return `NOT YET — onboarding can't complete. Still missing confirmed: ${missing.join(', ')}. Keep interviewing (one question at a time) until each is saved, then call this again.`;
    }
    const { error } = await supabase
      .from('companies')
      .update({ onboarding_complete: true, completed_at: new Date().toISOString() })
      .eq('id', companyId);
    if (error) return `ERROR completing onboarding: ${error.message}`;
    return 'Onboarding complete — the company profile is live and every employee can read it. Hand off to the dashboard.';
  }

  if (name === 'create_task') {
    // Resolve the assignee — anyone on the team (the Chief of Staff routes work).
    // Defaults to the current employee. Input is sanitized before it touches a filter.
    let assigneeId = employeeId;
    let assigneeName = '';
    const key = String(input.assignee ?? '').trim().toLowerCase().replace(/[^a-z0-9 ]/g, '');
    if (key) {
      let { data: emp } = await supabase.from('employees').select('id, name').eq('id', key).maybeSingle();
      if (!emp) ({ data: emp } = await supabase.from('employees').select('id, name').ilike('name', key).maybeSingle());
      if (emp) { assigneeId = emp.id; assigneeName = emp.name; }
    }
    const { error } = await supabase.from('tasks').insert({
      id: 't' + now,
      company_id: companyId,
      title: String(input.title ?? '').trim() || 'Untitled task',
      assignee_id: assigneeId,
      priority: (input.priority as string) || 'medium',
      project: (input.project as string) || 'General',
      status: 'queued',
      created_at: todayStr(),
      due_date: (input.due_date as string) || 'TBD',
      sort_order: now,
    });
    if (error) return `ERROR creating task: ${error.message}`;
    const who = assigneeId !== employeeId ? `to ${assigneeName || assigneeId}` : 'to you';
    return `Task created and assigned ${who}: "${input.title}" (${input.priority} priority).`;
  }
  if (name === 'remember_detail') {
    const kind = MEMORY_KINDS.includes(String(input.kind)) ? String(input.kind) : 'rapport';
    const type = kind === 'rapport' ? 'note' : kind;
    const defaultTitle = kind === 'rapport' ? 'Personal note' : kind.charAt(0).toUpperCase() + kind.slice(1);
    const title = (input.title as string) || defaultTitle;
    const content = String(input.content ?? '');

    // Profile types are SINGLETON per company — the brain holds one ICP, one offer,
    // one voice, one goal, one brand kit. Intake re-confirms these as it goes (a
    // draft "Offer — TBD" then the final offer), so UPSERT instead of insert:
    // update the latest row of this type and collapse any older duplicates. Other
    // kinds (proof, notes, decisions, ideas) stay append-only.
    if (PROFILE_MEMORY_TYPES.includes(type)) {
      const { data: existing } = await supabase
        .from('memory_entries')
        .select('id')
        .eq('company_id', companyId)
        .eq('type', type)
        .order('sort_order', { ascending: false });
      const rows = existing ?? [];
      if (rows.length > 0) {
        const keepId = rows[0].id;
        const { error: upErr } = await supabase
          .from('memory_entries')
          .update({ title, content, tags: [kind], updated_at: todayStr(), sort_order: now })
          .eq('id', keepId);
        if (upErr) return `ERROR updating memory: ${upErr.message}`;
        // Collapse any older duplicates of the same profile type.
        const staleIds = rows.slice(1).map((r) => r.id);
        if (staleIds.length) await supabase.from('memory_entries').delete().in('id', staleIds);
        return `Updated ${kind} in memory.`;
      }
    }

    const { error } = await supabase.from('memory_entries').insert({
      id: 'm' + now,
      company_id: companyId,
      type,
      title,
      content,
      tags: [kind],
      updated_at: todayStr(),
      sort_order: now,
    });
    if (error) return `ERROR saving memory: ${error.message}`;
    return `Saved to memory (${kind}). I'll remember that.`;
  }
  return `Unknown tool: ${name}`;
}

// ---------------------------------------------------------------------------
// System prompt: persona (Layer 1) + live company (Layer 2) + REAL data.
// Built in lib/chat-prompt.mjs — shared with the verification script.
// ---------------------------------------------------------------------------

interface Ctx {
  persona: string | null;
  employee: { name: string; role: string; personality: string; bio: string; responsibilities: unknown };
  company: Record<string, unknown> | null;
  memory: { type: string; title: string; content: string }[];
  tasks: { title: string; status: string; project: string; due_date: string }[];
  activity: { action: string; detail: string | null }[];
  roster: { name: string; role: string; status: string; bio: string }[];
}

// ---------------------------------------------------------------------------
// POST — send a message, stream the reply, persist both sides.
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response('ANTHROPIC_API_KEY is not set on the server.', { status: 500 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  let body: { employeeId?: string; message?: string; conversationId?: string; intakeMode?: boolean };
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  const employeeId = (body.employeeId || '').trim();
  const message = (body.message || '').trim();
  if (!employeeId || !message) return new Response('employeeId and message are required', { status: 400 });

  // Onboarding v2: intake runs through Atlas. In intakeMode we get-or-CREATE the
  // draft company to write to; otherwise a company must already exist.
  const intakeMode = body.intakeMode === true && employeeId === 'atlas';
  const companyId = intakeMode
    ? await getOrCreateDraftCompany(supabase, user.id)
    : await getCompanyId(supabase);
  if (!companyId) {
    return new Response(intakeMode ? 'Could not start onboarding' : 'Complete onboarding first', { status: 400 });
  }

  const { data: employee } = await supabase
    .from('employees')
    .select('id, name, role, personality, bio, responsibilities')
    .eq('id', employeeId)
    .maybeSingle();
  if (!employee) return new Response('Employee not found', { status: 404 });

  // Find or create the conversation for this employee + company.
  let conversationId = body.conversationId || '';
  if (!conversationId) {
    const { data: conv, error: convErr } = await supabase
      .from('conversations')
      .insert({ company_id: companyId, employee_id: employeeId, title: message.slice(0, 60) })
      .select('id')
      .single();
    if (convErr || !conv) return new Response('Could not start conversation', { status: 500 });
    conversationId = conv.id;
  }

  // Persist the user's message.
  await supabase.from('messages').insert({ conversation_id: conversationId, role: 'user', content: message });

  // Load the MOST RECENT messages (includes the user message we just saved).
  // Order descending + limit, then reverse to chronological — using ascending+limit
  // would return the OLDEST messages and drop the new one, ending the convo on an
  // assistant turn (prefill 400) once a conversation grows past the limit.
  const { data: recent } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(24);
  const history = (recent ?? []).reverse();
  // The window must start with a user turn (the API requires messages[0] to be user).
  while (history.length && history[0].role !== 'user') history.shift();

  // Load live context.
  const [{ data: company }, { data: memory }, { data: taskRows }, { data: activityRows }, { data: rosterRows }] = await Promise.all([
    supabase.from('companies').select('*').eq('id', companyId).maybeSingle(),
    supabase.from('memory_entries').select('type, title, content').eq('company_id', companyId).order('sort_order', { ascending: false }).limit(30),
    supabase.from('tasks').select('title, status, project, due_date').eq('company_id', companyId).eq('assignee_id', employeeId).order('sort_order', { ascending: false }).limit(40),
    supabase.from('activity_log').select('action, detail').eq('company_id', companyId).eq('employee_id', employeeId).order('sort_order', { ascending: false }).limit(20),
    supabase.from('employees').select('name, role, status, bio').order('name', { ascending: true }),
  ]);

  // ---- Chief of Staff (Atlas) sees the WHOLE board, not just his own work ----
  const isChiefOfStaff = employee.role === 'Chief of Staff' || employeeId === 'atlas';
  let allTasks: { title: string; status: string; project: string; due_date: string; assignee_id: string }[] = [];
  let leadPipeline: { total: number; qualified: number; drafted: number; pendingDrafts: number; overdue: number } | null = null;
  let kpiSnapshot: { employee: string; open: number; done: number }[] = [];
  if (isChiefOfStaff) {
    const [{ data: everyTask }, { data: leadRows }, { data: draftRows }] = await Promise.all([
      supabase.from('tasks').select('title, status, project, due_date, assignee_id').eq('company_id', companyId).order('sort_order', { ascending: false }).limit(200),
      supabase.from('leads').select('status, next_action_at').eq('company_id', companyId).limit(1000),
      supabase.from('lead_drafts').select('approval_status').eq('company_id', companyId).limit(1000),
    ]);
    const tasksAll = (everyTask ?? []) as typeof allTasks;
    allTasks = tasksAll.filter((t) => t.status !== 'completed');
    const leads = (leadRows ?? []) as { status: string; next_action_at: string | null }[];
    const now = Date.now();
    leadPipeline = {
      total: leads.length,
      qualified: leads.filter((l) => l.status === 'qualified').length,
      drafted: leads.filter((l) => l.status === 'drafted').length,
      pendingDrafts: ((draftRows ?? []) as { approval_status: string }[]).filter((d) => d.approval_status === 'pending').length,
      overdue: leads.filter((l) => l.next_action_at && new Date(l.next_action_at).getTime() < now && l.status !== 'disqualified' && l.status !== 'meeting').length,
    };
    const byEmp: Record<string, { open: number; done: number }> = {};
    for (const t of tasksAll) {
      const e = t.assignee_id || 'unknown';
      (byEmp[e] ??= { open: 0, done: 0 });
      if (t.status === 'completed') byEmp[e].done++; else byEmp[e].open++;
    }
    kpiSnapshot = Object.entries(byEmp).map(([employeeKey, v]) => ({ employee: employeeKey, open: v.open, done: v.done }));
  }

  const persona = await loadPersona(employeeId);
  const system = buildSystemPrompt({
    persona,
    employee: employee as Ctx['employee'],
    company: (company as Record<string, unknown>) ?? null,
    memory: (memory as Ctx['memory']) ?? [],
    tasks: (taskRows as Ctx['tasks']) ?? [],
    activity: (activityRows as Ctx['activity']) ?? [],
    roster: (rosterRows as Ctx['roster']) ?? [],
    isChiefOfStaff,
    allTasks,
    leadPipeline,
    kpiSnapshot,
    intakeMode,
    researchFindings: intakeMode
      ? ((company as Record<string, unknown> | null)?.research_findings as Record<string, unknown> | null) ?? null
      : null,
  });

  // Intake unlocks the onboarding tools (save_company_profile / complete_onboarding);
  // normal chat never sees them.
  const tools = toolsFor({ intakeMode }) as Anthropic.Tool[];

  const client = new Anthropic();
  const convo: Anthropic.MessageParam[] = (history ?? []).map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let assistantText = '';
      try {
        for (let i = 0; i < 6; i++) {
          const turn = client.messages.stream({
            model: MODEL,
            max_tokens: 4096,
            system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
            tools,
            messages: convo,
          });
          turn.on('text', (delta) => {
            assistantText += delta;
            controller.enqueue(encoder.encode(delta));
          });
          const final = await turn.finalMessage();
          convo.push({ role: 'assistant', content: final.content });

          if (final.stop_reason === 'tool_use') {
            const toolResults: Anthropic.ToolResultBlockParam[] = [];
            for (const block of final.content) {
              if (block.type === 'tool_use') {
                const result = await executeTool(
                  block.name,
                  block.input as Record<string, unknown>,
                  supabase,
                  companyId,
                  employeeId,
                  intakeMode
                );
                toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
              }
            }
            convo.push({ role: 'user', content: toolResults });
            continue; // let the model confirm in natural language
          }
          break; // end_turn
        }

        const clean = assistantText.trim();
        if (clean) {
          await supabase.from('messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: clean,
          });
        }
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Chat failed';
        controller.enqueue(encoder.encode(`\n\n[Error: ${msg}]`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Conversation-Id': conversationId,
    },
  });
}

// ---------------------------------------------------------------------------
// GET — load the latest conversation + messages for an employee.
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const employeeId = new URL(request.url).searchParams.get('employeeId') || '';
  if (!employeeId) return Response.json({ conversationId: null, messages: [] });

  const companyId = await getCompanyId(supabase);
  if (!companyId) return Response.json({ conversationId: null, messages: [] });

  const { data: conv } = await supabase
    .from('conversations')
    .select('id')
    .eq('company_id', companyId)
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conv) return Response.json({ conversationId: null, messages: [] });

  const { data: msgs } = await supabase
    .from('messages')
    .select('role, content, created_at')
    .eq('conversation_id', conv.id)
    .order('created_at', { ascending: true });

  return Response.json({ conversationId: conv.id, messages: msgs ?? [] });
}
