// Surge — Weekly CEO Briefing email (the day-14 retention anchor, CEO.md Failure
// Point #2). Every Monday ~08:00 in the owner's tz, the existing daily heartbeat cron
// emails the owner a one-page summary that makes inaction feel like losing money.
//
// Reuses the SAME data the in-app /briefing page shows (via the shared score formula
// and the same query shapes) so the email and the app never disagree. Plain ESM so the
// cron route (TS) and the verify script (node) share it. NOT metered — owner comms.

import { computeWorkforceScore } from './score.mjs';
import { notifyOwner, isConfigured } from './email.mjs';
import { appBaseUrl } from './sign.mjs';

const WEEK_MS = 7 * 24 * 3600 * 1000;
const DEFAULT_TZ = 'America/Chicago'; // Mitri's tz; used when a company has none set.

// ---- Pure time helpers (testable, no DB) -----------------------------------

/** Local Y/M/D in a timezone (locale-independent). */
function localParts(date, timeZone) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const o = {};
  for (const p of f.formatToParts(date)) if (p.type !== 'literal') o[p.type] = p.value;
  return { y: +o.year, m: +o.month, d: +o.day };
}

/** Short weekday in a timezone, e.g. 'Mon'. */
export function weekdayInTz(date, timeZone = DEFAULT_TZ) {
  return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date);
}

export function isMondayInTz(date, timeZone = DEFAULT_TZ) {
  return weekdayInTz(date, timeZone) === 'Mon';
}

/** ISO-week key (e.g. '2026-W23') for the LOCAL date in a timezone — the idempotency key. */
export function isoWeekKey(date, timeZone = DEFAULT_TZ) {
  const { y, m, d } = localParts(date, timeZone);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dayIdx = (dt.getUTCDay() + 6) % 7;        // Mon=0 … Sun=6
  dt.setUTCDate(dt.getUTCDate() - dayIdx + 3);    // the Thursday of this week
  const isoYear = dt.getUTCFullYear();
  const firstThu = new Date(Date.UTC(isoYear, 0, 4));
  const firstThuIdx = (firstThu.getUTCDay() + 6) % 7;
  firstThu.setUTCDate(firstThu.getUTCDate() - firstThuIdx + 3);
  const week = 1 + Math.round((dt.getTime() - firstThu.getTime()) / WEEK_MS);
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

/**
 * Estimated Potential Pipeline — the ONE allowed money figure. (qualified + warm) ×
 * the owner's own avg deal value. Returns null when avg deal value isn't set (the UI
 * then shows counts only and prompts to set it) — NEVER a fabricated dollar number.
 * Single source of truth, shared by the dashboard hero, the briefing email, and verify.
 */
export function estimatePipeline(pipelineLeads, avgDealValue) {
  if (avgDealValue == null || !(avgDealValue > 0)) return null;
  return Math.max(0, Number(pipelineLeads) || 0) * avgDealValue;
}

/** Score delta vs last week. null prev (or null current) → no delta shown. */
export function scoreDelta(current, previous) {
  if (current == null || previous == null) return { delta: null, dir: null };
  const delta = current - previous;
  return { delta, dir: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat' };
}

// ---- Build the briefing from real data -------------------------------------

/**
 * Assemble one company's weekly briefing from REAL data. Mirrors the /briefing page's
 * data layer (same score inputs, same attention signals) so email == app.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase  service- or owner-scoped
 */
export async function buildWeeklyBriefing(supabase, companyId, now = Date.now()) {
  const weekAgoMs = now - WEEK_MS;
  const weekAgoISO = new Date(weekAgoMs).toISOString();

  const [tasksRes, leadsRes, draftsRes, activityRes, sentRes, companyRes, dealRes] = await Promise.all([
    supabase.from('tasks').select('status, title, assignee_id').eq('company_id', companyId),
    supabase.from('leads').select('status, next_action_at, first_clicked_at, booked_at, created_at').eq('company_id', companyId),
    supabase.from('lead_drafts').select('approval_status, created_at').eq('company_id', companyId),
    supabase.from('activity_log').select('action, detail, employee_id, sort_order').eq('company_id', companyId).order('sort_order', { ascending: false }).limit(40),
    supabase.from('email_sends').select('status, created_at').eq('company_id', companyId).eq('status', 'sent').gte('created_at', weekAgoISO),
    supabase.from('companies').select('company_name').eq('id', companyId).maybeSingle(),
    supabase.from('memory_entries').select('content').eq('company_id', companyId).eq('type', 'deal_value').order('sort_order', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const tasks = tasksRes.data ?? [];
  const leads = leadsRes.data ?? [];
  const drafts = draftsRes.data ?? [];
  const activity = activityRes.data ?? [];

  // Score — identical inputs to lib/data.ts getWorkforceScore (shared formula).
  const recentLeads = leads.filter((l) => l.created_at && l.created_at >= weekAgoISO).length;
  const recentDrafts = drafts.filter((d) => d.created_at && d.created_at >= weekAgoISO).length;
  const scoreRes = computeWorkforceScore({
    tasksCompleted: tasks.filter((t) => t.status === 'completed').length,
    tasksOpen: tasks.filter((t) => t.status !== 'completed').length,
    leadsTotal: leads.length,
    leadsQualified: leads.filter((l) => ['qualified', 'drafted', 'warm', 'meeting', 'inbound', 'engaged'].includes(l.status)).length,
    leadsEngaged: leads.filter((l) => ['warm', 'meeting', 'engaged'].includes(l.status)).length,
    recentWork: recentLeads + recentDrafts,
  });

  // This-week counts (reliable timestamps only — never guess).
  const draftsSentWeek = (sentRes.data ?? []).length;
  const warmGainedWeek = leads.filter((l) => l.first_clicked_at && l.first_clicked_at >= weekAgoISO).length;
  const bookedWeek = leads.filter((l) => l.booked_at && l.booked_at >= weekAgoISO).length;
  const actionsThisWeek = activity.filter((a) => Number(a.sort_order) >= weekAgoMs);
  const accomplishments = actionsThisWeek.slice(0, 6).map((a) => ({ action: a.action, detail: a.detail, employeeId: a.employee_id }));

  // Needs-you signals — same as the page.
  const pending = drafts.filter((d) => d.approval_status === 'pending').length;
  const overdue = leads.filter((l) => l.next_action_at && Date.parse(l.next_action_at) < now && !['disqualified', 'meeting', 'recycled'].includes(l.status)).length;
  const attention = [];
  if (pending > 0) attention.push({ label: `${pending} outreach draft${pending > 1 ? 's' : ''} waiting on your approval`, owner: 'Aria', priority: 'high' });
  if (overdue > 0) attention.push({ label: `${overdue} lead${overdue > 1 ? 's have' : ' has'} an overdue next action`, owner: 'Aria', priority: 'high' });

  const planned = tasks.filter((t) => ['queued', 'in_progress'].includes(t.status)).slice(0, 6)
    .map((t) => ({ title: t.title, assigneeId: t.assignee_id, status: t.status }));

  const hasActivity = recentLeads > 0 || draftsSentWeek > 0 || warmGainedWeek > 0 || bookedWeek > 0 || actionsThisWeek.length > 0;

  // Estimated Potential Pipeline — the ONLY money figure, and only when the owner has
  // set their avg deal value. (qualified + warm) × avg deal value. Never fabricated.
  const pipelineLeads = leads.filter((l) => ['qualified', 'warm'].includes(l.status)).length;
  const adv = dealRes?.data?.content ? parseFloat(String(dealRes.data.content).replace(/[^0-9.]/g, '')) : NaN;
  const avgDealValue = Number.isFinite(adv) && adv > 0 ? adv : null;
  const potentialPipeline = estimatePipeline(pipelineLeads, avgDealValue);

  return {
    companyName: companyRes.data?.company_name || 'your company',
    score: scoreRes.score,
    hasActivity,
    counts: { leadsResearchedWeek: recentLeads, draftsSentWeek, warmGainedWeek, bookedWeek },
    pipelineLeads, avgDealValue, potentialPipeline,
    accomplishments,
    attention,
    planned,
    pending,
    overdue,
  };
}

// ---- Atlas's one line ------------------------------------------------------

function atlasLine(b) {
  if (b.pending > 0) return `This week: clear the ${b.pending} draft${b.pending > 1 ? 's' : ''} waiting on you — nothing reaches a prospect until you approve.`;
  if (b.overdue > 0) return `This week: re-engage the ${b.overdue} lead${b.overdue > 1 ? 's' : ''} that went quiet before they go cold.`;
  if (b.counts.warmGainedWeek > 0 || b.counts.bookedWeek > 0) return `This week: the warm ones are the ones that matter — reply fast while you're top of mind.`;
  if (!b.hasActivity) return `This week: give the team one clear directive and let them run — momentum compounds.`;
  return `This week: keep the pipeline moving — one focused push beats ten scattered ones.`;
}

// ---- Render the email (light theme, mobile-readable) -----------------------

function esc(s) { return String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

/**
 * Render { subject, html, text } from a briefing. Pure (no I/O). `delta` is from
 * scoreDelta(). `firstName` greets the owner; `appBase` deep-links into the app.
 */
export function renderBriefingEmail(b, { delta = { delta: null, dir: null }, firstName = 'there', appBase = appBaseUrl() } = {}) {
  const arrow = delta.dir === 'up' ? '▲' : delta.dir === 'down' ? '▼' : '';
  const deltaStr = delta.delta != null && delta.delta !== 0 ? ` ${arrow}${Math.abs(delta.delta)} vs last week` : '';
  const scoreStr = b.score != null ? String(b.score) : '—';
  const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
  const pipeStr = b.potentialPipeline != null ? `${money(b.potentialPipeline)}` : null;

  // Subject leads with the strongest OUTCOME (money > meetings > warm > leads), not the Score.
  const subject = !b.hasActivity
    ? `Your workforce had a quiet week — one move to make`
    : pipeStr
      ? `${pipeStr} in potential pipeline at ${b.companyName} this week`
      : b.counts.bookedWeek > 0
        ? `${b.counts.bookedWeek} meeting${b.counts.bookedWeek > 1 ? 's' : ''} booked this week at ${b.companyName}`
        : b.counts.leadsResearchedWeek > 0
          ? `${b.counts.leadsResearchedWeek} new lead${b.counts.leadsResearchedWeek > 1 ? 's' : ''} for ${b.companyName} this week`
          : `Your weekly briefing from Surge`;

  // ---- shared bits ----
  const did = [];
  if (b.counts.leadsResearchedWeek > 0) did.push(`${b.counts.leadsResearchedWeek} new lead${b.counts.leadsResearchedWeek > 1 ? 's' : ''} researched & scored`);
  if (b.counts.draftsSentWeek > 0) did.push(`${b.counts.draftsSentWeek} outreach email${b.counts.draftsSentWeek > 1 ? 's' : ''} sent`);
  if (b.counts.warmGainedWeek > 0) did.push(`${b.counts.warmGainedWeek} lead${b.counts.warmGainedWeek > 1 ? 's' : ''} went warm (clicked your link)`);
  if (b.counts.bookedWeek > 0) did.push(`${b.counts.bookedWeek} meeting${b.counts.bookedWeek > 1 ? 's' : ''} booked`);

  const line = atlasLine(b);

  // ---- TEXT ----
  const textParts = [
    `SURGE — WEEKLY CEO BRIEFING`,
    ``,
    `Good morning, ${firstName}.`,
    `${b.companyName}`,
    ``,
  ];
  // OUTCOMES FIRST — the money (honest, only when avg deal value is set), then counts.
  if (pipeStr) textParts.push(`ESTIMATED POTENTIAL PIPELINE: ${pipeStr}`, `  (${b.pipelineLeads} qualified + warm × ${money(b.avgDealValue)} avg deal — estimated)`, ``);
  if (b.hasActivity) {
    if (did.length) { textParts.push(`WHAT YOUR TEAM DID THIS WEEK`, ...did.map((d) => `  • ${d}`), ``); }
    if (b.attention.length) { textParts.push(`WHAT NEEDS YOU`, ...b.attention.map((a) => `  • ${a.label} (${a.owner})`), `  → ${appBase}/leads`, ``); }
    if (b.planned.length) { textParts.push(`WHAT'S PLANNED`, ...b.planned.map((p) => `  • ${p.title}`), `  → ${appBase}/tasks`, ``); }
  } else {
    textParts.push(`It was a quiet week — no new work logged.`, `Open the app and give your team one directive to get the pipeline moving again:`, `  → ${appBase}/dashboard`, ``);
  }
  textParts.push(`— Atlas`, line, ``, `Workforce health score: ${scoreStr}${deltaStr}`, `Sent every Monday. Manage notifications in Settings: ${appBase}/settings`);
  const text = textParts.join('\n');

  // ---- HTML ----
  const row = (inner) => `<tr><td style="padding:10px 24px;border-bottom:1px solid #eef0f4;font-size:14px;color:#374151;line-height:1.5">${inner}</td></tr>`;
  const sectionTitle = (t) => `<tr><td style="padding:18px 24px 6px;font-size:11px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;color:#6b7280">${esc(t)}</td></tr>`;
  const cta = (href, label) => `<tr><td style="padding:10px 24px 4px"><a href="${href}" style="color:#6366f1;font-size:13px;font-weight:600;text-decoration:none">${esc(label)} →</a></td></tr>`;

  let body = '';
  if (b.hasActivity) {
    if (did.length) { body += sectionTitle('What your team did this week') + did.map((d) => row(esc(d))).join(''); }
    if (b.attention.length) {
      body += sectionTitle('What needs you')
        + b.attention.map((a) => row(`<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ef4444;margin-right:8px"></span>${esc(a.label)} <span style="color:#9ca3af">· ${esc(a.owner)}</span>`)).join('')
        + cta(`${appBase}/leads`, 'Review in your pipeline');
    }
    if (b.planned.length) {
      body += sectionTitle("What's planned")
        + b.planned.map((p) => row(esc(p.title))).join('')
        + cta(`${appBase}/tasks`, 'See all tasks');
    }
  } else {
    body += sectionTitle('A quiet week')
      + row(`No new work was logged this week. Open the app and give your team one directive — momentum compounds.`)
      + cta(`${appBase}/dashboard`, 'Get the team moving');
  }

  const html = `<!doctype html><html><body style="margin:0;background:#f9fafb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">
        <tr><td style="padding:24px 24px 0">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.6px;color:#9ca3af">SURGE — WEEKLY CEO BRIEFING</div>
          <div style="font-size:22px;font-weight:800;color:#111827;margin-top:10px">Good morning, ${esc(firstName)}.</div>
          <div style="font-size:13px;color:#6b7280;margin-top:2px">${esc(b.companyName)}${b.score != null ? ` · workforce health ${scoreStr}${esc(deltaStr)}` : ''}</div>
        </td></tr>
        <tr><td style="padding:18px 24px">
          ${pipeStr ? `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:14px">
            <tr><td style="padding:20px 24px">
              <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#047857">Estimated potential pipeline</div>
              <div style="font-size:38px;font-weight:800;color:#047857;line-height:1.1">${pipeStr}</div>
              <div style="font-size:12px;color:#059669;margin-top:3px">${b.pipelineLeads} qualified + warm × ${money(b.avgDealValue)} avg deal — estimated</div>
            </td></tr>
          </table>` : `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:14px">
            <tr><td style="padding:18px 22px">
              <div style="font-size:15px;font-weight:700;color:#111827">${did.length ? esc(did[0]) : 'Your team is building your pipeline'}</div>
              <div style="font-size:13px;color:#6b7280;margin-top:4px">Set your average deal value to see your estimated pipeline. <a href="${appBase}/settings" style="color:#6366f1">Set it →</a></div>
            </td></tr>
          </table>`}
        </td></tr>
        <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}</table></td></tr>
        <tr><td style="padding:18px 24px;border-top:1px solid #eef0f4">
          <div style="font-size:14px;color:#111827;font-weight:600">— Atlas</div>
          <div style="font-size:13px;color:#6b7280;margin-top:4px;line-height:1.5">${esc(line)}</div>
        </td></tr>
        <tr><td style="padding:16px 24px;background:#f9fafb;text-align:center">
          <div style="font-size:11px;color:#9ca3af;line-height:1.6">Sent every Monday morning · Surge AI Workforce Platform<br>
          <a href="${appBase}/settings" style="color:#9ca3af">Manage notifications</a></div>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;

  return { subject, html, text };
}

// ---- Send for one company (idempotent, not metered) ------------------------

/**
 * Build + send the weekly briefing for one company, once per ISO week (idempotent via
 * briefing_sends). Skips not-onboarded companies. Quiet weeks still send a short nudge.
 * NOT metered (owner comms). dryRun records the idempotency row + returns the rendered
 * email WITHOUT calling the email provider (used by the verify script).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function sendWeeklyBriefingForCompany(supabase, companyId, { now = Date.now(), dryRun = false } = {}) {
  const { data: company } = await supabase
    .from('companies').select('user_id, company_name, onboarding_complete, timezone, is_internal').eq('id', companyId).maybeSingle();
  if (!company) return { sent: false, reason: 'no_company' };
  if (!company.onboarding_complete) return { sent: false, reason: 'not_onboarded' };

  const tz = company.timezone || DEFAULT_TZ;
  const weekKey = isoWeekKey(new Date(now), tz);

  // Idempotency: already sent this week?
  const { data: existing } = await supabase
    .from('briefing_sends').select('week_key').eq('company_id', companyId).eq('week_key', weekKey).maybeSingle();
  if (existing) return { sent: false, reason: 'already_sent', weekKey };

  // Previous score (most recent prior send) → this week's delta.
  const { data: prior } = await supabase
    .from('briefing_sends').select('score, sent_at').eq('company_id', companyId).order('sent_at', { ascending: false }).limit(1).maybeSingle();

  const briefing = await buildWeeklyBriefing(supabase, companyId, now);
  const delta = scoreDelta(briefing.score, prior?.score ?? null);

  // Owner email + name (service role → auth admin). Tolerate failure (dryRun/verify).
  let ownerEmail = null, firstName = 'there';
  try {
    if (company.user_id && supabase.auth?.admin?.getUserById) {
      const { data: u } = await supabase.auth.admin.getUserById(company.user_id);
      ownerEmail = u?.user?.email ?? null;
      const meta = (u?.user?.user_metadata ?? {});
      const full = String(meta.full_name || meta.name || '').trim() || (ownerEmail ? ownerEmail.split('@')[0] : '');
      if (full) firstName = full.split(/[\s._-]+/)[0].replace(/^\w/, (c) => c.toUpperCase());
    }
  } catch { /* no admin access (verify) — dryRun won't send anyway */ }

  const status = briefing.hasActivity ? 'sent' : 'quiet';
  const email = renderBriefingEmail(briefing, { delta, firstName });

  if (!dryRun) {
    if (!isConfigured()) return { sent: false, reason: 'email_not_configured', weekKey };
    if (!ownerEmail) return { sent: false, reason: 'no_owner_email', weekKey };
    const r = await notifyOwner({ to: ownerEmail, subject: email.subject, html: email.html, text: email.text, fromName: 'Atlas at Surge' });
    if (!r.ok) return { sent: false, reason: r.reason || 'send_failed', weekKey };
  }

  // Record the send (idempotency + next week's delta baseline). Ignore a race dup.
  await supabase.from('briefing_sends').insert({ company_id: companyId, week_key: weekKey, score: briefing.score ?? null, status });

  return { sent: true, reason: status, weekKey, score: briefing.score, delta, subject: email.subject, dryRun };
}
