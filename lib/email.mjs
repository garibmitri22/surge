// Surge — email channel (Resend). Plain ESM so routes (TS), the future Aria runner,
// and verify scripts share it. DORMANT until RESEND_API_KEY is set; even then it
// refuses to send without a CAN-SPAM physical address, honors the suppression list,
// and enforces warmup caps. Sending domain: getsurgehq.com (dedicated).
//
// Switch-on (when the accounts/DNS land): set RESEND_API_KEY (+ optional EMAIL_FROM,
// NEXT_PUBLIC_APP_URL) in .env.local, run supabase/email_migration.sql, set the
// company's physical_address. Then a caller (Aria's send_email tool) invokes sendEmail.

import { trackedLinkUrl } from './sign.mjs';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/** The verified sending identity. Override with EMAIL_FROM once the mailbox exists. */
export function fromAddress(companyName) {
  const addr = process.env.EMAIL_FROM || 'aria@getsurgehq.com';
  return companyName ? `${companyName} <${addr}>` : addr;
}

/** True only when the sending engine is wired. Gate every send on this. */
export function isConfigured() {
  return !!process.env.RESEND_API_KEY;
}

function appBaseUrl() {
  // The APP domain (where /api/unsubscribe lives) — NOT the sending domain. Set
  // NEXT_PUBLIC_APP_URL on Vercel; default to the prod app domain so links never
  // point at the email-only domain.
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://surgehq.io').replace(/\/$/, '');
}
export function unsubscribeUrl(token) {
  return `${appBaseUrl()}/api/unsubscribe?token=${encodeURIComponent(token)}`;
}

// ---- Warmup ----------------------------------------------------------------
// Ramp daily volume slowly to build sender reputation. Caps are per day-since-start.
// "10–20/day, scaling slowly over a few weeks" (Cowork) → start 10, reach 100 by ~day 31.
export const WARMUP_SCHEDULE = [
  { throughDay: 3, dailyCap: 10 },
  { throughDay: 7, dailyCap: 15 },
  { throughDay: 14, dailyCap: 25 },
  { throughDay: 21, dailyCap: 40 },
  { throughDay: 30, dailyCap: 60 },
  { throughDay: Infinity, dailyCap: 100 },
];

/** Daily send cap for a given 1-based day of warmup. */
export function warmupCapForDay(day) {
  const d = Math.max(1, Math.floor(day));
  return (WARMUP_SCHEDULE.find((s) => d <= s.throughDay) ?? WARMUP_SCHEDULE[WARMUP_SCHEDULE.length - 1]).dailyCap;
}

/** 1-based day number since warmup started (day 1 = the start date). */
export function warmupDay(startedAt, now = new Date()) {
  if (!startedAt) return 1;
  const start = new Date(startedAt + 'T00:00:00Z');
  const days = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return Math.max(1, days + 1);
}

// ---- CAN-SPAM footer -------------------------------------------------------
// Every commercial email MUST carry a real physical postal address + a working
// unsubscribe. This builds both; sendEmail refuses if the address is missing.
export function buildFooter({ companyName, physicalAddress, unsubUrl }) {
  const who = companyName || 'this business';
  const text = `\n\n—\nYou received this because ${who} is reaching out about a potential fit.\n${physicalAddress}\nUnsubscribe: ${unsubUrl}`;
  const html =
    `<div style="margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px;line-height:1.5">` +
    `You received this because ${who} is reaching out about a potential fit.<br>` +
    `${physicalAddress}<br>` +
    `<a href="${unsubUrl}" style="color:#9ca3af">Unsubscribe</a></div>`;
  return { text, html };
}

/** Is this recipient already suppressed (unsubscribed/bounced)? */
export async function isSuppressed(supabase, companyId, email) {
  const { data } = await supabase
    .from('email_suppressions').select('email').eq('company_id', companyId).eq('email', email.toLowerCase()).maybeSingle();
  return !!data;
}

/**
 * Send one email through Resend — fully gated. Returns { ok, reason?, id?, providerId? }.
 * Never throws on a refusal; every path logs to email_sends. NOTHING sends unless:
 * the key is set, the company has a physical address, the recipient isn't suppressed,
 * and today's volume is under the warmup cap.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function sendEmail(supabase, { companyId, leadId = null, to, subject, html = '', text = '' }) {
  if (!isConfigured()) return { ok: false, reason: 'email_not_configured' };
  const recipient = String(to || '').trim().toLowerCase();
  if (!recipient || !subject) return { ok: false, reason: 'missing_fields' };

  const { data: company } = await supabase
    .from('companies').select('company_name, physical_address, warmup_started_at').eq('id', companyId).maybeSingle();
  const physicalAddress = company?.physical_address?.trim();
  if (!physicalAddress) return { ok: false, reason: 'no_physical_address' }; // CAN-SPAM hard gate

  if (await isSuppressed(supabase, companyId, recipient)) {
    await supabase.from('email_sends').insert({ company_id: companyId, lead_id: leadId, to_email: recipient, subject, status: 'skipped', reason: 'suppressed' });
    return { ok: false, reason: 'suppressed' };
  }

  // Warmup cap: count today's sent rows for this company.
  const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0);
  const { count: sentToday } = await supabase
    .from('email_sends').select('id', { count: 'exact', head: true })
    .eq('company_id', companyId).eq('status', 'sent').gte('created_at', startOfDay.toISOString());
  const cap = warmupCapForDay(warmupDay(company?.warmup_started_at));
  if ((sentToday ?? 0) >= cap) return { ok: false, reason: 'warmup_cap', cap, sentToday: sentToday ?? 0 };

  // Reserve a row to mint the unsub token, then send with the compliant footer.
  const { data: row, error: insErr } = await supabase
    .from('email_sends').insert({ company_id: companyId, lead_id: leadId, to_email: recipient, subject, status: 'pending' })
    .select('id, unsub_token').single();
  if (insErr || !row) return { ok: false, reason: 'log_failed' };

  const unsubUrl = unsubscribeUrl(row.unsub_token);
  const footer = buildFooter({ companyName: company?.company_name, physicalAddress, unsubUrl });

  try {
    const resp = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromAddress(company?.company_name),
        to: recipient,
        subject,
        html: (html || `<p>${text}</p>`) + footer.html,
        text: (text || '') + footer.text,
        headers: { 'List-Unsubscribe': `<${unsubUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      }),
    });
    const out = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      await supabase.from('email_sends').update({ status: 'failed', reason: String(out?.message || resp.status) }).eq('id', row.id);
      return { ok: false, reason: 'provider_error', detail: out?.message };
    }
    await supabase.from('email_sends').update({ status: 'sent', provider_id: out?.id ?? null }).eq('id', row.id);
    // First send starts the warmup clock.
    if (!company?.warmup_started_at) {
      await supabase.from('companies').update({ warmup_started_at: new Date().toISOString().slice(0, 10) }).eq('id', companyId);
    }
    return { ok: true, id: row.id, providerId: out?.id ?? null };
  } catch (e) {
    await supabase.from('email_sends').update({ status: 'failed', reason: e instanceof Error ? e.message : 'send error' }).eq('id', row.id);
    return { ok: false, reason: 'send_exception' };
  }
}

// ---- Tracked CTA -----------------------------------------------------------
// Every outbound draft carries exactly ONE tracked CTA link (the warm signal). The
// link is a signed per-lead token (lib/sign.mjs) — a click promotes the lead to warm
// and pings the owner. Drafts are authored with a {{CTA_URL}} placeholder which we
// replace with the real link; if a draft has neither the placeholder nor an
// /api/r/ link yet (older drafts), we append a clean CTA line. Idempotent.
export function embedTrackedCta(body, url) {
  const text = String(body || '');
  if (text.includes('{{CTA_URL}}')) return text.split('{{CTA_URL}}').join(url);
  if (text.includes('/api/r/')) return text; // already has a tracked link
  return `${text.trimEnd()}\n\nBook a quick call: ${url}`;
}

/**
 * Send a transactional email to the OWNER (not a prospect): the "your AI team sent
 * me this" moment. No CAN-SPAM footer, no warmup cap, no suppression — this is a
 * 1:1 product notification to the account owner, not commercial outreach. Gated on
 * isConfigured(); never throws.
 */
export async function notifyOwner({ to, subject, html = '', text = '', fromName = 'Aria at Surge' }) {
  if (!isConfigured()) return { ok: false, reason: 'email_not_configured' };
  const recipient = String(to || '').trim();
  if (!recipient || !subject) return { ok: false, reason: 'missing_fields' };
  try {
    const resp = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromAddress(fromName),
        to: recipient,
        subject,
        html: html || `<p>${text}</p>`,
        text: text || '',
      }),
    });
    if (!resp.ok) { const o = await resp.json().catch(() => ({})); return { ok: false, reason: 'provider_error', detail: o?.message }; }
    const out = await resp.json().catch(() => ({}));
    return { ok: true, providerId: out?.id ?? null };
  } catch (e) {
    return { ok: false, reason: 'send_exception', detail: e instanceof Error ? e.message : 'error' };
  }
}

/**
 * Deliver one approved draft: load the draft + its lead, embed the per-lead tracked
 * CTA link, send via sendEmail (all the gates apply), and on success mark the draft
 * 'sent' and advance the lead to 'contacted' with the next Lead-Lifeline follow-up in
 * 3 days. Shared by the approve route and the heartbeat warmup drip. Never throws.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} companyId @param {string} draftId
 */
export async function deliverDraft(supabase, companyId, draftId) {
  const { data: draft } = await supabase
    .from('lead_drafts').select('id, lead_id, subject, body').eq('id', draftId).eq('company_id', companyId).maybeSingle();
  if (!draft) return { ok: false, reason: 'draft_not_found' };
  const { data: lead } = await supabase
    .from('leads').select('email, business_name').eq('id', draft.lead_id).eq('company_id', companyId).maybeSingle();
  const to = lead?.email?.trim();
  if (!to) return { ok: false, reason: 'no_recipient_email' };

  // Embed the signed tracked CTA (per-lead, idempotent) just before sending.
  let outboundBody = draft.body;
  try { outboundBody = embedTrackedCta(draft.body, trackedLinkUrl(draft.lead_id, companyId)); } catch { /* secret missing — send as-is */ }

  const r = await sendEmail(supabase, { companyId, leadId: draft.lead_id, to, subject: draft.subject, text: outboundBody });
  if (!r.ok) return r;

  await supabase.from('lead_drafts').update({ approval_status: 'sent' }).eq('id', draftId);
  const next = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  await supabase.from('leads').update({ status: 'contacted', next_action: 'Follow up (day 3)', next_action_at: next }).eq('id', draft.lead_id).eq('company_id', companyId);
  return { ok: true, providerId: r.providerId ?? null };
}
