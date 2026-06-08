// Surge — Atlas's brain for the real-time VOICE channel (JARVIS Phase 3).
//
// The live ElevenLabs agent runs OUR Claude brain via a custom-LLM webhook (/api/voice/llm).
// This module is the shared core for that path: a signed session token (identity over the
// internet hop), the SAME live system prompt the text chat builds (buildSystemPrompt), the
// shared tool schema (toolsFor), and a tool executor scoped to ONE company. Kept separate
// from the chat route so the production streaming chat is never destabilized.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './supabase';
import { buildSystemPrompt, toolsFor, summarizeLeadState, summarizeChannels, PROFILE_MEMORY_TYPES } from './chat-prompt.mjs';
import { allowanceForPlan } from './pricing.mjs';
import { isConfigured as isEmailConfigured } from './email.mjs';
// Session token (identity across the server-to-server hop) lives in a shared .mjs so the verify
// script can round-trip it. Re-exported here so callers have one brain surface.
import { signVoiceToken, verifyVoiceToken } from './voice-token.mjs';
export { signVoiceToken, verifyVoiceToken };

type SB = SupabaseClient<Database>;

// ---- Live Atlas context: the SAME brain the text chat uses ----------------------------------
type TaskRow = { title: string; status: string; project: string; due_date: string; assignee_id: string };

export async function loadAtlasContext(
  supabase: SB,
  companyId: string,
  ownerName = '',
): Promise<{ system: string; greeting: string }> {
  const { data: employee } = await supabase
    .from('employees').select('id, name, role, personality, bio, responsibilities').eq('id', 'atlas').maybeSingle();

  const [{ data: company }, { data: memory }, { data: taskRows }, { data: activityRows }, { data: rosterRows }] = await Promise.all([
    supabase.from('companies').select('*').eq('id', companyId).maybeSingle(),
    supabase.from('memory_entries').select('type, title, content').eq('company_id', companyId).order('sort_order', { ascending: false }).limit(30),
    supabase.from('tasks').select('title, status, project, due_date').eq('company_id', companyId).eq('assignee_id', 'atlas').order('sort_order', { ascending: false }).limit(40),
    supabase.from('activity_log').select('action, detail').eq('company_id', companyId).eq('employee_id', 'atlas').order('sort_order', { ascending: false }).limit(20),
    supabase.from('employees').select('name, role, status, bio').order('name', { ascending: true }),
  ]);

  // Atlas sees the WHOLE board (same queries as the chat route's chief-of-staff branch).
  const [{ data: everyTask }, { data: leadRows }, { data: draftRows }, sentRes] = await Promise.all([
    supabase.from('tasks').select('title, status, project, due_date, assignee_id').eq('company_id', companyId).order('sort_order', { ascending: false }).limit(200),
    supabase.from('leads').select('status, next_action_at, click_count').eq('company_id', companyId).limit(1000),
    supabase.from('lead_drafts').select('approval_status').eq('company_id', companyId).limit(1000),
    supabase.from('email_sends').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'sent'),
  ]);

  const tasksAll = (everyTask ?? []) as TaskRow[];
  const allTasks = tasksAll.filter((t) => t.status !== 'completed');
  const leads = (leadRows ?? []) as { status: string; next_action_at: string | null; click_count: number | null }[];
  const drafts = (draftRows ?? []) as { approval_status: string }[];
  const leadPipeline = summarizeLeadState({ leads, drafts, sentCount: sentRes.count ?? 0, now: Date.now() });

  const co = (company as Record<string, unknown> | null) ?? {};
  const channels = summarizeChannels({
    emailConfigured: isEmailConfigured(),
    physicalAddress: (co.physical_address as string) ?? '',
    twilioNumber: (co.twilio_number as string) ?? '',
    tendlcStatus: (co.tendlc_status as string) ?? '',
  });

  const byEmp: Record<string, { open: number; done: number }> = {};
  for (const t of tasksAll) {
    const e = t.assignee_id || 'unknown';
    (byEmp[e] ??= { open: 0, done: 0 });
    if (t.status === 'completed') byEmp[e].done++; else byEmp[e].open++;
  }
  const kpiSnapshot = Object.entries(byEmp).map(([emp, v]) => ({ employee: emp, open: v.open, done: v.done }));

  let hoursStatus: { balance: number; allowance: number; low: boolean } | null = null;
  try {
    const { data: bal, error } = await supabase.rpc('hours_balance', { p_company: companyId });
    if (!error) {
      const plan = ((company as Record<string, unknown> | null)?.plan as string) || 'single';
      const allowance = allowanceForPlan(plan);
      const balance = Number(bal ?? 0);
      hoursStatus = { balance, allowance, low: allowance > 0 && balance / allowance < 0.15 };
    }
  } catch { /* hours migration not applied — omit */ }

  let persona: string | null = null;
  try { persona = await readFile(path.join(process.cwd(), 'personas', 'atlas.md'), 'utf8'); } catch { /* ship without */ }

  const base = buildSystemPrompt({
    persona,
    employee: (employee as { name: string; role: string; personality: string; bio: string; responsibilities: unknown }) ?? { name: 'Atlas', role: 'Chief of Staff', personality: '', bio: '', responsibilities: [] },
    company: (company as Record<string, unknown>) ?? null,
    memory: (memory as { type: string; title: string; content: string }[]) ?? [],
    tasks: (taskRows as { title: string; status: string; project: string; due_date: string }[]) ?? [],
    activity: (activityRows as { action: string; detail: string | null }[]) ?? [],
    roster: (rosterRows as { name: string; role: string; status: string; bio: string }[]) ?? [],
    isChiefOfStaff: true,
    allTasks,
    leadPipeline,
    channels,
    kpiSnapshot,
    hoursStatus,
  });

  // Voice addendum: spoken replies must be short and natural — no markdown, no lists.
  const system = `${base}\n\n# VOICE MODE\nYou are speaking OUT LOUD in a live, hands-free conversation. Keep replies short and conversational — usually one to three sentences. No markdown, no bullet lists, no headers, no emoji — it will be read aloud. Sound like a calm chief of staff talking, not writing a document. When you take an action with a tool, say so in one plain sentence.`;

  return { system, greeting: buildGreeting(ownerName, leadPipeline) };
}

function buildGreeting(name: string, pipeline: ReturnType<typeof summarizeLeadState>): string {
  const hi = name ? `Hey ${name.split(' ')[0]}.` : 'Hey.';
  if (pipeline && pipeline.total > 0) {
    const bits: string[] = [];
    if (pipeline.pendingDrafts) bits.push(`${pipeline.pendingDrafts} draft${pipeline.pendingDrafts > 1 ? 's' : ''} waiting on your approval`);
    if (pipeline.meeting) bits.push(`${pipeline.meeting} meeting${pipeline.meeting > 1 ? 's' : ''} booked`);
    const tail = bits.length ? ` ${bits.join(', and ')}.` : ` ${pipeline.total} leads in the pipeline.`;
    return `${hi} Atlas here.${tail} What do you want to move first?`;
  }
  return `${hi} Atlas here. We don't have leads in the pipeline yet — want me to put Aria on prospecting, or talk through the plan first?`;
}

// ---- Tools (shared schema) + executor (scoped to ONE company) --------------------------------
/** The same non-intake tool schema the text chat exposes (create_task, remember_detail). */
export function voiceTools() {
  return toolsFor({ intakeMode: false });
}

const todayStr = () => new Date().toISOString().split('T')[0];

/** Execute a voice tool against the owner's company. Mirrors the chat route's executeTool for
 *  the two non-intake tools; never touches onboarding tools. Service-role-safe (explicit company_id). */
export async function executeVoiceTool(
  supabase: SB,
  companyId: string,
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  const now = Date.now();

  if (name === 'create_task') {
    let assigneeId = 'aria';
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
    return `Task created for ${assigneeName || assigneeId}: "${String(input.title ?? '').trim()}".`;
  }

  if (name === 'remember_detail') {
    const kind = String(input.kind ?? 'rapport');
    const type = kind === 'rapport' ? 'note' : kind;
    const title = String(input.title ?? '').trim() || (kind.charAt(0).toUpperCase() + kind.slice(1));
    const content = String(input.content ?? '').trim();
    if (!content) return 'Nothing to save.';
    try {
      if ((PROFILE_MEMORY_TYPES as string[]).includes(type)) {
        const { data: existing } = await supabase
          .from('memory_entries').select('id').eq('company_id', companyId).eq('type', type).order('sort_order', { ascending: false });
        const rows = existing ?? [];
        if (rows.length > 0) {
          await supabase.from('memory_entries').update({ title, content, tags: [kind], updated_at: todayStr(), sort_order: now }).eq('id', rows[0].id);
          const stale = rows.slice(1).map((r) => r.id);
          if (stale.length) await supabase.from('memory_entries').delete().in('id', stale);
          return `Saved to memory (${kind}). I'll remember that.`;
        }
      }
      const { error } = await supabase.from('memory_entries').insert({
        id: 'm' + now + Math.floor(Math.random() * 1000),
        company_id: companyId, type, title, content, tags: [kind], updated_at: todayStr(), sort_order: now,
      });
      if (error) return `ERROR saving memory: ${error.message}`;
    } catch (e) {
      return `ERROR saving memory: ${e instanceof Error ? e.message : 'unknown'}`;
    }
    return `Saved to memory (${kind}). I'll remember that.`;
  }

  return `Unknown tool: ${name}`;
}
