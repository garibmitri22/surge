// Surge — Twilio transport (Programmable Messaging + Voice) via REST + fetch, no SDK
// (same pattern as lib/email.mjs / Resend). DORMANT until the keys are set; callers
// must still pass the consent/10DLC gate in lib/inbound.mjs BEFORE calling sendSms —
// this module is the wire, not the policy.

import { createHmac } from 'node:crypto';

const API_BASE = 'https://api.twilio.com/2010-04-01';

/**
 * Validate an incoming Twilio webhook signature (X-Twilio-Signature). Twilio signs
 * `url + each POST param appended as key+value, sorted by key`, HMAC-SHA1 with the
 * auth token, base64. Rejecting unsigned/forged webhooks stops anyone spoofing a lead
 * reply. Returns true/false. (url must be the exact public URL Twilio was configured with.)
 */
export function validateTwilioSignature(authToken, url, params, signature) {
  if (!authToken || !signature) return false;
  const sorted = Object.keys(params || {}).sort();
  let data = url;
  for (const k of sorted) data += k + String(params[k] ?? '');
  const expected = createHmac('sha1', authToken).update(Buffer.from(data, 'utf-8')).digest('base64');
  // Constant-time-ish compare.
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

/** True only when the Twilio account is wired. Gate every send on this AND the
 *  consent/10DLC gate (canSend) in lib/inbound.mjs. */
export function isConfigured() {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

function authHeader() {
  const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN;
  return 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64');
}

function appBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://surgehq.io').replace(/\/$/, '');
}

/**
 * Send one SMS. Prefers a Messaging Service SID (carries 10DLC registration) and
 * falls back to a from-number. Returns { ok, sid?, reason?, detail? }. Never throws.
 * NOTE: this does NOT check consent/10DLC — the caller MUST gate with canSend first.
 */
export async function sendSms({ to, body, fromNumber, messagingServiceSid }) {
  if (!isConfigured()) return { ok: false, reason: 'twilio_not_configured' };
  const recipient = String(to || '').trim();
  if (!recipient || !body) return { ok: false, reason: 'missing_fields' };
  if (!messagingServiceSid && !fromNumber) return { ok: false, reason: 'no_sender' };

  const form = new URLSearchParams();
  form.set('To', recipient);
  form.set('Body', String(body).slice(0, 1500));
  if (messagingServiceSid) form.set('MessagingServiceSid', messagingServiceSid);
  else form.set('From', fromNumber);
  // Status callbacks could be wired later; omitted in Phase 1.

  try {
    const resp = await fetch(`${API_BASE}/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: authHeader(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const out = await resp.json().catch(() => ({}));
    if (!resp.ok) return { ok: false, reason: 'provider_error', detail: out?.message || resp.status };
    return { ok: true, sid: out?.sid ?? null };
  } catch (e) {
    return { ok: false, reason: 'send_exception', detail: e instanceof Error ? e.message : 'error' };
  }
}

/**
 * Owner-bridge call: call the OWNER first; when they answer, Twilio fetches TwiML from
 * /api/voice/connect which dials the lead and bridges them ("press 1 to connect"). No
 * AI voice speaks to the consumer in Phase 1. Returns { ok, sid?, reason? }.
 */
export async function bridgeCall({ ownerPhone, leadId, fromNumber }) {
  if (!isConfigured()) return { ok: false, reason: 'twilio_not_configured' };
  if (!ownerPhone || !fromNumber) return { ok: false, reason: 'missing_fields' };
  const twimlUrl = `${appBaseUrl()}/api/voice/connect?lead=${encodeURIComponent(leadId)}`;
  const form = new URLSearchParams();
  form.set('To', ownerPhone);     // ring the owner first
  form.set('From', fromNumber);
  form.set('Url', twimlUrl);      // on answer, Twilio GETs the bridge TwiML
  try {
    const resp = await fetch(`${API_BASE}/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Calls.json`, {
      method: 'POST',
      headers: { Authorization: authHeader(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const out = await resp.json().catch(() => ({}));
    if (!resp.ok) return { ok: false, reason: 'provider_error', detail: out?.message || resp.status };
    return { ok: true, sid: out?.sid ?? null };
  } catch (e) {
    return { ok: false, reason: 'call_exception', detail: e instanceof Error ? e.message : 'error' };
  }
}
