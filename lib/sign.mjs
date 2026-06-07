// Surge — signed tracked-link tokens (the warm-signal CTA).
//
// Every outbound email carries ONE per-lead CTA link. The link is an opaque,
// HMAC-signed token that encodes { leadId, companyId } — NEVER the raw IDs in the
// URL, and tamper-proof: flip a byte and verify() rejects it. Deterministic given
// the secret, so the same lead always yields the same link (idempotent to embed at
// draft time and re-derive at send/verify time). Plain ESM so routes (TS) and the
// verify script (node) share the exact codec.

import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';

// Secret resolver. Prefer an explicit SURGE_LINK_SECRET (set it in Vercel + .env.local
// to pin link validity across other key rotations); otherwise fall back to a stable
// secret that already exists in every environment that sends mail. Empty strings are
// skipped (the sandbox shell exports an empty ANTHROPIC_API_KEY that would shadow).
export function signingSecret() {
  const candidates = [
    process.env.SURGE_LINK_SECRET,
    process.env.RESEND_API_KEY,
    process.env.ANTHROPIC_API_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ];
  const secret = candidates.find((s) => typeof s === 'string' && s.length > 0);
  if (!secret) throw new Error('No signing secret available (set SURGE_LINK_SECRET).');
  return secret;
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const fromB64url = (str) => Buffer.from(str, 'base64url');

function hmac(payloadB64, secret) {
  return createHmac('sha256', secret).update(payloadB64).digest(); // Buffer
}

/**
 * Sign a payload object into a compact `payload.sig` token (base64url, URL-safe).
 * @param {{ l: string, c: string }} payload  l = leadId, c = companyId
 * @returns {string}
 */
export function signToken(payload, secret = signingSecret()) {
  const payloadB64 = b64url(JSON.stringify(payload));
  const sig = b64url(hmac(payloadB64, secret));
  return `${payloadB64}.${sig}`;
}

/**
 * Verify + decode a token. Returns the payload, or null if malformed / tampered.
 * Constant-time signature comparison.
 * @returns {{ l: string, c: string } | null}
 */
export function verifyToken(token, secret = signingSecret()) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const dot = token.indexOf('.');
  const payloadB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);
  if (!payloadB64 || !sigB64) return null;
  let expected, given;
  try {
    expected = hmac(payloadB64, secret);
    given = fromB64url(sigB64);
  } catch {
    return null;
  }
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const obj = JSON.parse(fromB64url(payloadB64).toString('utf8'));
    if (obj && typeof obj.l === 'string' && typeof obj.c === 'string') return obj;
    return null;
  } catch {
    return null;
  }
}

/** Convenience: the signed token for one lead. */
export function leadToken(leadId, companyId, secret = signingSecret()) {
  return signToken({ l: leadId, c: companyId }, secret);
}

/** The app base URL (where /r lives) — the APP domain.
 *  DELIVERABILITY NOTE (for later): this click domain (surgehq.io) differs from the
 *  sending domain (getsurgehq.com). Mismatched click vs sending domains can dent
 *  deliverability and look less trustworthy to filters. Consider serving these short
 *  links from a subdomain of the SENDING domain (e.g. link.getsurgehq.com) so the click
 *  host aligns with the From/DKIM domain — set NEXT_PUBLIC_APP_URL accordingly and point
 *  that host at this app. No code change needed beyond the env var. */
export function appBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://surgehq.io').replace(/\/$/, '');
}

/** The legacy full tracked CTA URL (long inline HMAC token). Kept for back-compat with
 *  links already sent; new outbound uses createTrackedLink() short opaque codes. */
export function trackedLinkUrl(leadId, companyId, secret = signingSecret()) {
  return `${appBaseUrl()}/api/r/${leadToken(leadId, companyId, secret)}`;
}

// Short opaque CTA codes — base62, unguessable, validated server-side against the
// tracked_links table. Replaces the ~180-char inline HMAC token in the public URL so
// the link reads as surgehq.io/r/aB3xK9q (trustworthy, deliverable) instead of phishy.
const B62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** A random base62 string of the given length (unguessable, URL-safe). */
export function randomCode(len = 8) {
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += B62[bytes[i] % 62];
  return out;
}

/**
 * Allocate a short opaque tracked-link code for one lead and return its public URL
 * (`${appBaseUrl()}/r/<code>`). Inserts the tracked_links row; the table's PK IS the
 * collision check — a duplicate code raises 23505, so we just retry (escalating 7→8
 * chars). At 62^7 (~3.5e12) collisions are effectively impossible. The code carries no
 * data, so NO HMAC token rides in the URL — it's resolved server-side at click time.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<string>} the full short CTA URL
 */
export async function createTrackedLink(supabase, leadId, companyId) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randomCode(attempt < 3 ? 7 : 8); // bump to 8 only if 7 keeps colliding
    const { error } = await supabase.from('tracked_links').insert({ code, lead_id: leadId, company_id: companyId });
    if (!error) return `${appBaseUrl()}/r/${code}`;
    if (error.code !== '23505') throw new Error(`tracked_links insert failed: ${error.message}`);
  }
  throw new Error('Could not allocate a unique tracked-link code');
}
