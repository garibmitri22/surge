// Surge — signed tracked-link tokens (the warm-signal CTA).
//
// Every outbound email carries ONE per-lead CTA link. The link is an opaque,
// HMAC-signed token that encodes { leadId, companyId } — NEVER the raw IDs in the
// URL, and tamper-proof: flip a byte and verify() rejects it. Deterministic given
// the secret, so the same lead always yields the same link (idempotent to embed at
// draft time and re-derive at send/verify time). Plain ESM so routes (TS) and the
// verify script (node) share the exact codec.

import { createHmac, timingSafeEqual } from 'node:crypto';

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

/** The app base URL (where /api/r lives) — the APP domain, never the sending domain. */
export function appBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://surgehq.io').replace(/\/$/, '');
}

/** The full tracked CTA URL embedded in outbound email for one lead. */
export function trackedLinkUrl(leadId, companyId, secret = signingSecret()) {
  return `${appBaseUrl()}/api/r/${leadToken(leadId, companyId, secret)}`;
}
