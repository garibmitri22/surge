// Surge — the proactive heartbeat (Level 4: "work happened while you slept").
// Enforces Aria's Lead Lifeline without the owner lifting a finger: overdue leads
// get surfaced as a recovery task, truly-dead leads (90+ days) get recycled. Pure
// planSweep is unit-tested; applySweep works with ANY Supabase client (the owner's
// session for the live per-visit sweep, or a service-role client for the cron).
// Plain ESM so routes + verify share it.

import { isConfigured, deliverDraft } from './email.mjs';

const NINETY_DAYS = 90 * 24 * 3600 * 1000;
const todayStr = () => new Date().toISOString().split('T')[0];

/**
 * Decide what the sweep should do, from the lead list. Pure + deterministic.
 * Active overdue leads → resurface (recovery task). Active overdue AND older than
 * 90 days with no progress → recycle (stop chasing a dead lead).
 * @param {{id:string,status:string,next_action_at:string|null,created_at?:string|null}[]} leads
 * @param {number} nowMs
 * @returns {{ overdueIds:string[], recycleIds:string[], overdueCount:number, recycleCount:number }}
 */
export function planSweep(leads, nowMs) {
  const overdueIds = [];
  const recycleIds = [];
  for (const l of leads || []) {
    // Respect an owner override — never auto-recycle or re-touch a lead the owner set by hand.
    if (l.manual_override) continue;
    // Terminal stages (incl. the manual won/lost) are never swept.
    const active = !['disqualified', 'meeting', 'won', 'lost', 'recycled'].includes(l.status);
    if (!active) continue;
    const due = l.next_action_at ? Date.parse(l.next_action_at) : NaN;
    if (Number.isNaN(due) || due >= nowMs) continue; // not overdue
    const created = l.created_at ? Date.parse(l.created_at) : nowMs;
    if (!Number.isNaN(created) && nowMs - created > NINETY_DAYS) recycleIds.push(l.id);
    else overdueIds.push(l.id);
  }
  return { overdueIds, recycleIds, overdueCount: overdueIds.length, recycleCount: recycleIds.length };
}

/**
 * Run the sweep for one company against a Supabase client (RLS- or service-scoped).
 * Idempotent per day: the recovery task is created at most once per day, so repeated
 * runs don't spam the board. Returns a report.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} companyId
 * @param {number} [nowMs]
 */
export async function applySweep(supabase, companyId, nowMs = Date.now()) {
  const { data: leads } = await supabase
    .from('leads').select('*').eq('company_id', companyId); // '*' so manual_override is read when live (resilient pre-migration)
  const plan = planSweep(leads ?? [], nowMs);

  // Recycle dead leads (90+ days, still overdue). Naturally idempotent — once
  // recycled they no longer match.
  if (plan.recycleIds.length) {
    await supabase.from('leads').update({ status: 'recycled' }).in('id', plan.recycleIds).eq('company_id', companyId);
  }

  // Surface overdue leads as ONE recovery task for Aria — but only if there isn't
  // already an open Lead Lifeline task from today (idempotency).
  let taskCreated = false;
  if (plan.overdueCount > 0) {
    const { data: existing } = await supabase
      .from('tasks').select('id')
      .eq('company_id', companyId).eq('project', 'Lead Lifeline').eq('created_at', todayStr()).neq('status', 'completed')
      .limit(1);
    if (!existing || existing.length === 0) {
      const now = Date.now();
      await supabase.from('tasks').insert({
        id: 't' + now,
        company_id: companyId,
        title: `Re-engage ${plan.overdueCount} overdue lead${plan.overdueCount > 1 ? 's' : ''}`,
        assignee_id: 'aria',
        priority: 'high',
        project: 'Lead Lifeline',
        status: 'queued',
        created_at: todayStr(),
        due_date: todayStr(),
        sort_order: now,
      });
      taskCreated = true;
    }
  }

  // Standing daily cycle: if Aria is IDLE (no open task) and the brain has a directive
  // (an ICP or a goal to prospect for), queue her a daily prospecting task. Naturally
  // idempotent — once she has an open task she won't get another, and re-engaging
  // overdue leads (above) takes priority over fresh prospecting. Execution still goes
  // through Run + the hours gate, so this queues work but never auto-spends.
  let dailyCycleQueued = false;
  {
    const { data: openAria } = await supabase
      .from('tasks').select('id')
      .eq('company_id', companyId).eq('assignee_id', 'aria').in('status', ['queued', 'in_progress']).limit(1);
    if (!openAria || openAria.length === 0) {
      const { data: directive } = await supabase
        .from('memory_entries').select('id').eq('company_id', companyId).in('type', ['icp', 'goal']).limit(1);
      if (directive && directive.length > 0) {
        const now = Date.now();
        await supabase.from('tasks').insert({
          id: 't' + now,
          company_id: companyId,
          title: 'Daily prospecting — find & score new leads',
          assignee_id: 'aria',
          priority: 'medium',
          project: 'Daily Prospecting',
          status: 'queued',
          created_at: todayStr(),
          due_date: todayStr(),
          sort_order: now,
        });
        dailyCycleQueued = true;
      }
    }
  }

  // Warmup drip: send owner-APPROVED drafts, up to today's warmup cap. sendEmail
  // enforces the cap (returns warmup_cap once hit) — we stop for the day then.
  // Suppressed recipients are terminally rejected; everything else (no email yet,
  // provider not ready) stays approved to retry. Only runs when email is wired.
  let sent = 0;
  if (isConfigured()) {
    const { data: approved } = await supabase
      .from('lead_drafts').select('id').eq('company_id', companyId).eq('approval_status', 'approved').limit(50);
    for (const d of approved ?? []) {
      const r = await deliverDraft(supabase, companyId, d.id);
      if (r.ok) { sent++; continue; }
      if (r.reason === 'warmup_cap') break;
      if (r.reason === 'suppressed') await supabase.from('lead_drafts').update({ approval_status: 'rejected' }).eq('id', d.id);
      // no_recipient_email / provider_error / not_configured → leave approved, retry later
    }
  }

  // Log a single activity summary only when something actually happened (idempotent).
  if (taskCreated || plan.recycleIds.length || dailyCycleQueued || sent) {
    const bits = [];
    if (taskCreated) bits.push(`flagged ${plan.overdueCount} overdue follow-up${plan.overdueCount > 1 ? 's' : ''}`);
    if (plan.recycleIds.length) bits.push(`recycled ${plan.recycleIds.length} stale lead${plan.recycleIds.length > 1 ? 's' : ''}`);
    if (dailyCycleQueued) bits.push('queued today’s prospecting');
    if (sent) bits.push(`sent ${sent} approved email${sent > 1 ? 's' : ''}`);
    await supabase.from('activity_log').insert({
      id: 'a' + Date.now() + Math.floor(Math.random() * 1000),
      company_id: companyId,
      employee_id: 'aria',
      action: `Lead Lifeline sweep — ${bits.join(', ')}`,
      detail: null,
      timestamp: 'just now',
      sort_order: Date.now(),
    });
  }

  return { overdueCount: plan.overdueCount, recycleCount: plan.recycleIds.length, taskCreated, dailyCycleQueued, sent };
}
