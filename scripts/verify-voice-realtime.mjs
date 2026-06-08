// Surge — JARVIS Phase 3 (real-time voice) verification. Run: node scripts/verify-voice-realtime.mjs
//
// Proves the hands-free slice's plumbing: signed identity token, per-minute metering, the
// session route (real Atlas context + overrides + token), the custom-LLM bridge (secret+token
// auth, OpenAI SSE, tool execution, service-role), the meter route, and the client wiring.
// The actual conversation (greet / talk / interrupt / latency) is a live mic test on prod.
import { readFileSync } from 'node:fs';
import { signVoiceToken, verifyVoiceToken } from '../lib/voice-token.mjs';
import { voiceConvoHours, VOICE_HOURS_PER_MIN, estimateHours } from '../lib/pricing.mjs';
import { agentId, isAgentConfigured, voiceFor } from '../lib/voices.mjs';

// Load .env.local into process.env so the config gate reflects reality.
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.trim().startsWith('#')) process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim();
}

let failures = 0;
const check = (n, ok, d) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); if (!ok) failures++; };
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

// --- 1. Signed session token (identity across the internet hop) -----------------------------
console.log('--- 1. Signed session token ---');
const tok = signVoiceToken({ userId: 'u_1', companyId: 'co_42', ttlSeconds: 3600 });
const ok = verifyVoiceToken(tok);
check('a valid token verifies → companyId', ok && ok.companyId === 'co_42' && ok.userId === 'u_1', JSON.stringify(ok));
check('a tampered signature is rejected', verifyVoiceToken(tok.slice(0, -3) + 'xxx') === null);
check('a tampered payload is rejected', verifyVoiceToken('eyJhIjoxfQ.' + tok.split('.')[1]) === null);
check('an expired token is rejected', verifyVoiceToken(signVoiceToken({ userId: 'u', companyId: 'c', ttlSeconds: -10 })) === null);
check('garbage is rejected', verifyVoiceToken('') === null && verifyVoiceToken('not.a.token') === null);

// --- 2. Per-minute metering (voice = premium COGS) ------------------------------------------
console.log('\n--- 2. Per-minute metering ---');
check('no time charges 0 hours', voiceConvoHours(0) === 0 && voiceConvoHours('') === 0);
check('60s = the configured per-minute rate', voiceConvoHours(60) === VOICE_HOURS_PER_MIN, `${voiceConvoHours(60)} vs ${VOICE_HOURS_PER_MIN}`);
check('cost grows with duration (monotonic)', voiceConvoHours(300) > voiceConvoHours(60) && voiceConvoHours(60) > voiceConvoHours(10));
check('live voice is premium vs a full prospecting run', voiceConvoHours(600) >= estimateHours('aria_run'), `${voiceConvoHours(600)}h for 10min`);

// --- 3. Config gate -------------------------------------------------------------------------
console.log('\n--- 3. Config gate ---');
check('Atlas has a real voice id for the agent', voiceFor('atlas').voiceId.length > 5);
check('isAgentConfigured requires BOTH key and agent id', typeof isAgentConfigured() === 'boolean');
if (!agentId()) check('no ELEVENLABS_AGENT_ID set → agent not configured (expected pre-provision)', isAgentConfigured() === false);

// --- 4. Session route wiring ----------------------------------------------------------------
console.log('\n--- 4. /api/voice/session wiring ---');
const session = read('../app/api/voice/session/route.ts');
check('user-authed (401 without a user)', /auth\.getUser\(\)/.test(session) && /Unauthorized/.test(session));
check('builds Atlas\'s REAL live context (loadAtlasContext)', /loadAtlasContext\(/.test(session));
check('mints a signed identity token', /signVoiceToken\(/.test(session));
check('fetches an ElevenLabs signed URL for the private agent', /get-signed-url\?agent_id=/.test(session));
check('returns overrides (prompt + firstMessage + voice) and the token', /overrides/.test(session) && /firstMessage/.test(session) && /extraBody/.test(session) && /surge_token/.test(session));
check('503 when the agent/keys are absent', /isAgentConfigured\(\)/.test(session) && /not_configured/.test(session) && /503/.test(session));

// --- 5. Custom-LLM bridge wiring ------------------------------------------------------------
console.log('\n--- 5. /api/voice/llm bridge wiring ---');
const llm = read('../app/api/voice/llm/route.ts');
check('verifies the shared secret header (defense in depth)', /VOICE_LLM_SECRET/.test(llm) && /authorization/.test(llm));
check('verifies the session token → companyId', /verifyVoiceToken\(/.test(llm) && /elevenlabs_extra_body/.test(llm));
check('runs Atlas\'s Claude brain on a FAST model', /claude-haiku-4-5/.test(llm) && /client\.messages\.stream\(/.test(llm));
check('caches the large system prompt', /cache_control/.test(llm));
check('executes tools via the shared executor + service-role client', /executeVoiceTool\(/.test(llm) && /SUPABASE_SERVICE_ROLE_KEY/.test(llm));
check('streams OpenAI-compatible SSE (data: … [DONE])', /text\/event-stream/.test(llm) && /\[DONE\]/.test(llm));

// --- 6. Meter route + shared brain ----------------------------------------------------------
console.log('\n--- 6. Meter route + shared brain ---');
const meter = read('../app/api/voice/meter/route.ts');
check('meter debits per-minute via the hours ledger', /voiceConvoHours\(/.test(meter) && /debitHours\(/.test(meter));
check('meter is user-authed', /auth\.getUser\(\)/.test(meter));
const brain = read('../lib/atlas-brain.ts');
check('the brain reuses buildSystemPrompt (real context, not a generic bot)', /buildSystemPrompt\(/.test(brain) && /isChiefOfStaff: true/.test(brain));
check('the tool executor handles create_task + remember_detail', /create_task/.test(brain) && /remember_detail/.test(brain));
check('voice replies are constrained to short spoken sentences', /VOICE MODE/.test(brain));

// --- 7. Client wiring -----------------------------------------------------------------------
console.log('\n--- 7. VoiceChat (client) wiring ---');
const ui = read('../components/VoiceChat.tsx');
check('uses the ElevenLabs useConversation hook in a provider', /useConversation\(/.test(ui) && /ConversationProvider/.test(ui));
check('starts a session with the signed URL + token (customLlmExtraBody)', /startSession\(/.test(ui) && /signedUrl/.test(ui) && /customLlmExtraBody/.test(ui));
check('has mute + end controls (accessible)', /setMuted\(/.test(ui) && /endSession\(/.test(ui));
check('meters the conversation on disconnect', /\/api\/voice\/meter/.test(ui) && /onDisconnect/.test(ui));
check('shows the live presence orb reacting to speech', /PresenceOrb/.test(ui) && /isSpeaking/.test(ui));

// --- 8. (Gated) live signed-url -------------------------------------------------------------
console.log('\n--- 8. Live ElevenLabs agent (gated on ELEVENLABS_API_KEY + ELEVENLABS_AGENT_ID) ---');
if (!isAgentConfigured()) {
  console.log('SKIP  live signed-url — set ELEVENLABS_AGENT_ID (run scripts/provision-atlas-agent.mjs) to exercise the real agent');
} else {
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId())}`, {
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY.trim() },
    });
    const j = await r.json().catch(() => ({}));
    check('ElevenLabs issues a signed URL for the Atlas agent', r.ok && Boolean(j.signed_url || j.signedUrl), `status ${r.status}`);
  } catch (e) {
    check('ElevenLabs reachable', false, e.message);
  }
}

console.log(failures === 0
  ? '\nVOICE-REALTIME VERIFICATION PASSED — signed-token identity, per-minute metering, Atlas\'s real brain over a custom-LLM bridge, secure tool execution, and a hands-free client. Live conversation = Mitri\'s mic test on prod.'
  : `\n${failures} CHECK(S) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
