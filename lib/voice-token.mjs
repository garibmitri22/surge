// Surge — signed session token for the real-time voice custom-LLM hop (JARVIS Phase 3).
//
// ElevenLabs calls /api/voice/llm server-to-server with NO user cookie. The browser (already
// authenticated) relays this short-lived HMAC token via customLlmExtraBody; the webhook verifies
// it → companyId, so tool writes hit the right tenant and the token can't be replayed forever.
// Plain .mjs so the TS routes AND the node verify script share one implementation (no drift).
import crypto from 'node:crypto';

function tokenSecret() {
  return (
    process.env.VOICE_LLM_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.CRON_SECRET ||
    'surge-dev-voice-secret-change-me'
  );
}

export function signVoiceToken({ userId, companyId, ttlSeconds = 3600 }) {
  const body = { userId, companyId, exp: Date.now() + ttlSeconds * 1000 };
  const data = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = crypto.createHmac('sha256', tokenSecret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyVoiceToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const expected = crypto.createHmac('sha256', tokenSecret()).update(data).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const body = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!body.companyId || !body.userId || typeof body.exp !== 'number' || body.exp < Date.now()) return null;
    return body;
  } catch {
    return null;
  }
}
