import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { buildSystemPrompt, chatTools } from '@/lib/chat-prompt.mjs';

const MODEL = 'claude-sonnet-4-6';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SupabaseServer = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function getCompanyId(supabase: SupabaseServer): Promise<string | null> {
  const { data } = await supabase
    .from('companies')
    .select('id')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
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
// so the live verification can never drift from production).
// ---------------------------------------------------------------------------

const tools = chatTools as Anthropic.Tool[];

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  supabase: SupabaseServer,
  companyId: string,
  employeeId: string
): Promise<string> {
  const now = Date.now();
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
    const ALLOWED = ['decision', 'open-loop', 'idea', 'rapport', 'note'];
    const kind = ALLOWED.includes(String(input.kind)) ? String(input.kind) : 'rapport';
    const defaultTitle = kind === 'rapport' ? 'Personal note' : kind.charAt(0).toUpperCase() + kind.slice(1);
    const { error } = await supabase.from('memory_entries').insert({
      id: 'm' + now,
      company_id: companyId,
      type: kind === 'rapport' ? 'note' : kind,
      title: (input.title as string) || defaultTitle,
      content: String(input.content ?? ''),
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

  let body: { employeeId?: string; message?: string; conversationId?: string };
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  const employeeId = (body.employeeId || '').trim();
  const message = (body.message || '').trim();
  if (!employeeId || !message) return new Response('employeeId and message are required', { status: 400 });

  const companyId = await getCompanyId(supabase);
  if (!companyId) return new Response('Complete onboarding first', { status: 400 });

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
  });

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
                  employeeId
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
