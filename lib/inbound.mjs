// Surge — inbound / speed-to-lead POLICY spine (TCPA compliance lives here).
//
// CONSENT-FIRST, server-enforced: no SMS/call goes out unless there is a stored
// consent record for that channel, 10DLC is registered, the number isn't opted out,
// and Twilio is wired. is_internal NEVER bypasses these — they're legal, not billing.
// Plain ESM so routes (TS) and verify (node) share the exact gate.

import { isConfigured as twilioConfigured, sendSms } from './twilio.mjs';
import { signToken, verifyToken } from './sign.mjs';
import { debitHours, estimateHours } from './hours.mjs';

// ---- Capture-form tokens (per-company, signed; reuse the HMAC codec) -------
// A hosted capture form lives at /capture/<token>; the token binds the form to ONE
// company so leads can't be injected for arbitrary tenants. l='capture' is the marker.
export function captureToken(companyId, secret) {
  return signToken({ l: 'capture', c: companyId }, secret);
}
export function verifyCaptureToken(token, secret) {
  const obj = verifyToken(token, secret);
  return obj && obj.l === 'capture' ? obj.c : null;
}

// ---- Opt-out detection (TCPA STOP keywords) --------------------------------
const OPT_OUT = new Set(['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit', 'stop all', 'optout', 'opt-out', 'opt out']);
export function isOptOut(body) {
  return OPT_OUT.has(String(body || '').trim().toLowerCase());
}

/** Has this phone opted out for this company? */
export async function isSmsSuppressed(supabase, companyId, phone) {
  if (!phone) return false;
  const { data } = await supabase
    .from('sms_suppressions').select('phone').eq('company_id', companyId).eq('phone', String(phone).trim()).maybeSingle();
  return !!data;
}

/** Record an opt-out (idempotent). Called by the STOP handler. */
export async function suppressSms(supabase, companyId, phone, reason = 'stop') {
  if (!phone) return;
  await supabase.from('sms_suppressions').insert({ company_id: companyId, phone: String(phone).trim(), reason });
}

// ---- TCPA quiet hours (local 8pm–8am) — applied to proactive follow-ups ----
export function inQuietHours(date, timeZone = 'America/Chicago') {
  const hour = +new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hour12: false }).format(date);
  return hour >= 21 || hour < 8;
}

/**
 * THE GATE. Can we send an SMS to this lead right now? Returns { ok, reason, sender? }.
 * Checked server-side before EVERY send. No is_internal bypass — consent + 10DLC are law.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function canSendSms(supabase, company, lead) {
  if (!twilioConfigured()) return { ok: false, reason: 'twilio_not_configured' };
  if (!company) return { ok: false, reason: 'no_company' };
  if (company.tendlc_status !== 'registered') return { ok: false, reason: 'tendlc_not_registered' };

  const phone = lead?.phone?.trim();
  if (!phone) return { ok: false, reason: 'no_phone' };

  const channels = Array.isArray(lead?.consent_channels) ? lead.consent_channels : [];
  if (!lead?.consent_at || !channels.includes('sms')) return { ok: false, reason: 'no_consent' };

  if (await isSmsSuppressed(supabase, company.id, phone)) return { ok: false, reason: 'opted_out' };

  const messagingServiceSid = company.twilio_messaging_service_sid || null;
  const fromNumber = company.twilio_number || null;
  if (!messagingServiceSid && !fromNumber) return { ok: false, reason: 'no_sender' };

  return { ok: true, sender: { messagingServiceSid, fromNumber }, phone };
}

// ---- Inbound payload normalization (one shape from every adapter) ----------
/**
 * Normalize a raw adapter payload into the lead fields we store. The Surge-hosted form
 * already posts clean fields; ad-platform adapters map their field names here later.
 */
export function normalizeInboundPayload(raw = {}, source = 'surge_form') {
  const pick = (...keys) => { for (const k of keys) if (raw[k]) return String(raw[k]).trim(); return null; };
  const consent = raw.consent === true || raw.consent === 'true' || raw.consent === 'on' || raw.consent === '1';
  const channels = Array.isArray(raw.consent_channels) && raw.consent_channels.length
    ? raw.consent_channels.filter((c) => ['sms', 'call', 'email'].includes(c))
    : (consent ? ['sms', 'call'] : []);
  return {
    name: pick('name', 'full_name', 'first_name'),
    phone: pick('phone', 'phone_number', 'tel'),
    email: pick('email', 'email_address'),
    consent,
    consent_channels: channels,
    consent_text: pick('consent_text') || null,
    source,
  };
}

// ---- Once-per-conversation metering (idempotent; never on failure) ---------
/**
 * Debit the inbound-conversation hours ONCE per lead (not per message). Idempotent via
 * a hours_ledger marker (ref_type='conversation', ref_id=leadId). is_internal bypasses
 * the DEBIT (billing) but never the consent gate. Returns true if it debited now.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function debitConversationOnce(supabase, companyId, leadId) {
  const { data: existing } = await supabase
    .from('hours_ledger').select('id').eq('company_id', companyId).eq('ref_type', 'conversation').eq('ref_id', leadId).limit(1);
  if (existing && existing.length > 0) return false; // already charged for this conversation
  await debitHours(supabase, companyId, estimateHours('inbound_conversation'), 'Inbound lead conversation', { employeeId: 'aria', refType: 'conversation', refId: leadId });
  return true;
}

/**
 * THE SEND CHOKEPOINT. Gate (consent + 10DLC + opt-out + config) → send → log →
 * stamp first-touch → meter once. Returns the gate reason and sends NOTHING when the
 * gate fails; never logs or charges on a failed send. Both inbound routes go through
 * here, so the consent rule can't be bypassed.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function deliverSms(supabase, company, lead, body) {
  const gate = await canSendSms(supabase, company, lead);
  if (!gate.ok) return gate; // refused — no send, no log, no charge

  const r = await sendSms({ to: gate.phone, body, fromNumber: gate.sender.fromNumber, messagingServiceSid: gate.sender.messagingServiceSid });
  if (!r.ok) return { ok: false, reason: r.reason, detail: r.detail }; // never charge for a failed send

  await supabase.from('lead_messages').insert({
    company_id: company.id, lead_id: lead.id, direction: 'outbound', channel: 'sms', body, twilio_sid: r.sid ?? null,
  });
  if (!lead.first_touch_at) {
    await supabase.from('leads').update({ first_touch_at: new Date().toISOString() }).eq('id', lead.id).eq('company_id', company.id);
  }
  await debitConversationOnce(supabase, company.id, lead.id);
  return { ok: true, sid: r.sid ?? null };
}
