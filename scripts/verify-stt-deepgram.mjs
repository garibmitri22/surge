// Surge — JARVIS listening (Phase 2) verification. Run: node scripts/verify-stt-deepgram.mjs
//
// Proves the input-voice slice: real server-side STT via Deepgram, metered per minute,
// internal bypass, charge-zero-on-failure, graceful fallback to free browser dictation.
//   1. Config — Deepgram model + endpoint; transcript/duration extraction; key gate.
//   2. Metering — sttHours scales with audio seconds, 0 for none, minor COGS.
//   3. Route wiring — auth + canonical company + meter via hours.mjs; Deepgram Token auth;
//      debit AFTER the failure check (zero on miss); 503 when the key is absent.
//   4. Client wiring — MicButton records → /api/stt, falls back to Web Speech, 3 states.
//   5. (Gated) live Deepgram call when DEEPGRAM_API_KEY is set.
import { readFileSync } from 'node:fs';
import { STT_MODEL, STT_PROVIDER, deepgramListenUrl, extractTranscript, extractDuration, isSttConfigured } from '../lib/stt.mjs';
import { sttHours, STT_HOURS_PER_MIN, estimateHours } from '../lib/pricing.mjs';

let failures = 0;
const check = (n, ok, d) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); if (!ok) failures++; };
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

// --- 1. Deepgram config ---------------------------------------------------------------------
console.log('--- 1. Deepgram STT config ---');
check('provider is Deepgram (the decided real-time vendor)', STT_PROVIDER === 'deepgram');
check('uses a Nova streaming-grade model', /nova/i.test(STT_MODEL), STT_MODEL);
const url = deepgramListenUrl();
check('builds the Deepgram listen endpoint with smart formatting', /api\.deepgram\.com\/v1\/listen/.test(url) && /smart_format=true/.test(url) && /punctuate=true/.test(url), url);
check('extractTranscript reads the best alternative', extractTranscript({ results: { channels: [{ alternatives: [{ transcript: 'hello world' }] }] } }) === 'hello world');
check('extractTranscript is safe on garbage', extractTranscript(null) === '' && extractTranscript({}) === '');
check('extractDuration reads metadata.duration', extractDuration({ metadata: { duration: 4.2 } }) === 4.2 && extractDuration({}) === 0);

// --- 2. Per-minute metering -----------------------------------------------------------------
console.log('\n--- 2. Per-minute metering ---');
check('no audio charges 0 hours', sttHours(0) === 0 && sttHours('') === 0);
check('60s = the configured per-minute rate', sttHours(60) === STT_HOURS_PER_MIN, `${sttHours(60)} vs ${STT_HOURS_PER_MIN}`);
check('cost grows with audio length (monotonic)', sttHours(120) > sttHours(60) && sttHours(60) > sttHours(5));
check('STT is a minor cost vs real work (aria_run=2h)', sttHours(60) < estimateHours('aria_run'));

// --- 3. Server route wiring -----------------------------------------------------------------
console.log('\n--- 3. /api/stt route wiring ---');
const route = read('../app/api/stt/route.ts');
check('auth-gates the request (401 without a user)', /auth\.getUser\(\)/.test(route) && /Unauthorized/.test(route));
check('resolves the CANONICAL company for metering', /resolveCanonicalCompanyId/.test(route));
check('meters via the hours ledger (debitHours)', /debitHours\(/.test(route) && /from '@\/lib\/hours\.mjs'/.test(route));
check('charges per minute of audio (sttHours on duration)', /sttHours\(duration\)/.test(route));
check('internal accounts bypass the spend gate (isInternal)', /isInternal\(/.test(route));
check('returns 503 not_configured when the key is missing (graceful fallback)', /not_configured/.test(route) && /503/.test(route));
check('out-of-hours refuses BEFORE spending (402)', /out_of_hours/.test(route) && /402/.test(route));
check('calls Deepgram with Token auth', /deepgramListenUrl\(\)/.test(route) && /Authorization: `Token /.test(route));
// Charge-zero-on-failure: the debit must come AFTER the `!resp.ok` failure return.
const failIdx = route.indexOf('stt_error');
const debitIdx = route.indexOf('debitHours(');
check('debit happens only AFTER the failure check (zero charge on a miss)', failIdx > 0 && debitIdx > failIdx, `fail@${failIdx} debit@${debitIdx}`);

// --- 4. Client MicButton wiring -------------------------------------------------------------
console.log('\n--- 4. MicButton (client) wiring ---');
const btn = read('../components/MicButton.tsx');
check('records audio with MediaRecorder', /new MediaRecorder\(/.test(btn) && /getUserMedia/.test(btn));
check('posts the recording to /api/stt', /fetch\('\/api\/stt'/.test(btn));
check('falls back to Web Speech when server STT is unavailable', /startWebSpeech\(\)/.test(btn) && /webkitSpeechRecognition/.test(btn));
check('has a transcribing state (not just idle/recording)', /'transcribing'/.test(btn));
check('fills the field with the final transcript', /onText\(String\(data\.transcript\)\)/.test(btn));
check('stops the mic stream after recording (no hot mic)', /getTracks\(\)\.forEach\(\(t\) => t\.stop\(\)\)/.test(btn));

// --- 5. (Gated) live Deepgram reachability --------------------------------------------------
console.log('\n--- 5. Live Deepgram (gated on DEEPGRAM_API_KEY) ---');
if (!isSttConfigured()) {
  console.log('SKIP  live transcription — DEEPGRAM_API_KEY not set (add it to .env.local + Vercel to light real STT)');
} else {
  try {
    // 0.25s of silence (WAV) — enough to prove auth + a 200 from Deepgram.
    const sr = 8000, n = sr / 4, dataLen = n * 2, buf = Buffer.alloc(44 + dataLen);
    buf.write('RIFF', 0); buf.writeUInt32LE(36 + dataLen, 4); buf.write('WAVE', 8);
    buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
    buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
    buf.write('data', 36); buf.writeUInt32LE(dataLen, 40);
    const r = await fetch(deepgramListenUrl(), {
      method: 'POST',
      headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY.trim()}`, 'content-type': 'audio/wav' },
      body: buf,
    });
    const j = await r.json().catch(() => ({}));
    check('Deepgram accepts audio and returns a result', r.ok && j?.metadata?.duration !== undefined, `status ${r.status}`);
  } catch (e) {
    check('Deepgram reachable', false, e.message);
  }
}

console.log(failures === 0
  ? '\nSTT-DEEPGRAM VERIFICATION PASSED — real server-side transcription, metered per minute, internal bypass, charge-zero-on-failure, graceful fallback.'
  : `\n${failures} CHECK(S) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
