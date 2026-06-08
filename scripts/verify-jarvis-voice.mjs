// Surge — JARVIS voice (Phase 1) verification. Run: node scripts/verify-jarvis-voice.mjs
//
// Proves the output-voice slice: a DISTINCT ElevenLabs voice per agent, metered per
// character, internal bypass, charge-zero-on-failure, graceful fallback, mute respected.
//   1. Config — 4 distinct persona-matched voice ids; unknown → JARVIS (Atlas) fallback; Flash model.
//   2. Metering — ttsHours scales with characters, 0 for empty, dwarfed by real work.
//   3. Route wiring — auth + canonical company + meter via hours.mjs; debit AFTER the failure
//      check (zero on miss); 503 when the key is absent (client falls back).
//   4. Client wiring — SpeakButton hits /api/tts, falls back to Web Speech, caches per message,
//      respects the mute setting, never autoplays.
//   5. (Gated) live ElevenLabs call when ELEVENLABS_API_KEY is set.
import { readFileSync } from 'node:fs';
import { voiceFor, VOICES, VOICE_EMPLOYEES, TTS_MODEL, forSpeech, isTtsConfigured } from '../lib/voices.mjs';
import { ttsHours, TTS_HOURS_PER_1K_CHARS, estimateHours } from '../lib/pricing.mjs';

let failures = 0;
const check = (n, ok, d) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); if (!ok) failures++; };
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

// --- 1. Voice config: distinct, persona-matched, Flash --------------------------------------
console.log('--- 1. Per-agent voice config ---');
const ids = ['atlas', 'aria', 'nova', 'opus'].map((e) => voiceFor(e).voiceId);
check('all four agents map to a voice id', ids.every((v) => typeof v === 'string' && v.length > 5), ids.join(', '));
check('every agent voice is DISTINCT (no two share a voice)', new Set(ids).size === 4, `${new Set(ids).size}/4 unique`);
check('VOICE_EMPLOYEES lists exactly the four agents', VOICE_EMPLOYEES.length === 4 && ['atlas', 'aria', 'nova', 'opus'].every((e) => VOICE_EMPLOYEES.includes(e)));
check('Atlas is the JARVIS voice (deep/calm character on file)', /deep|calm|steady|jarvis/i.test(VOICES.atlas.character));
check('an unknown employee falls back to the Atlas (house) voice', voiceFor('mystery').voiceId === VOICES.atlas.voiceId);
check('model is a low-latency Flash/Turbo model', /flash|turbo/i.test(TTS_MODEL), TTS_MODEL);
check('each agent has tunable voice_settings', ['atlas', 'aria', 'nova', 'opus'].every((e) => VOICES[e].settings && typeof VOICES[e].settings.stability === 'number'));

// forSpeech cleans markdown/emoji/links so the voice reads prose, not symbols.
const cleaned = forSpeech('**Hey** _there_ — see [the docs](https://x.com) 🚀 `code` ## title');
check('forSpeech strips markdown/links/emoji', !/[*_`#]|https?:|🚀|\]\(/.test(cleaned) && /Hey there/.test(cleaned), JSON.stringify(cleaned));

// --- 2. Metering (voice is $/char) ----------------------------------------------------------
console.log('\n--- 2. Per-character metering ---');
check('empty text charges 0 hours', ttsHours(0) === 0 && ttsHours('') === 0);
check('1000 chars = the configured per-1k rate', ttsHours(1000) === TTS_HOURS_PER_1K_CHARS, `${ttsHours(1000)} vs ${TTS_HOURS_PER_1K_CHARS}`);
check('cost grows with length (monotonic)', ttsHours(2000) > ttsHours(1000) && ttsHours(1000) > ttsHours(100));
check('a typical ~400-char reply is a small fraction of an hour', ttsHours(400) > 0 && ttsHours(400) < 0.1, `${ttsHours(400)}h`);
check('a spoken reply costs far less than real work (aria_run=2h)', ttsHours(600) < estimateHours('aria_run'));

// --- 3. Server route wiring -----------------------------------------------------------------
console.log('\n--- 3. /api/tts route wiring ---');
const route = read('../app/api/tts/route.ts');
check('auth-gates the request (401 without a user)', /auth\.getUser\(\)/.test(route) && /Unauthorized/.test(route));
check('resolves the CANONICAL company for metering', /resolveCanonicalCompanyId/.test(route));
check('meters via the hours ledger (debitHours)', /debitHours\(/.test(route) && /from '@\/lib\/hours\.mjs'/.test(route));
check('charges per character (ttsHours)', /ttsHours\(/.test(route));
check('internal accounts bypass the spend gate (isInternal)', /isInternal\(/.test(route));
check('returns 503 not_configured when the key is missing (graceful fallback)', /not_configured/.test(route) && /503/.test(route));
check('out-of-hours refuses BEFORE spending (402)', /out_of_hours/.test(route) && /402/.test(route));
check('calls ElevenLabs with the Flash model + voice id', /api\.elevenlabs\.io\/v1\/text-to-speech/.test(route) && /model_id: TTS_MODEL/.test(route));
// Charge-zero-on-failure: the debit must come AFTER the `!resp.ok` failure return.
const failIdx = route.indexOf('tts_error');
const debitIdx = route.indexOf('debitHours(');
check('debit happens only AFTER the failure check (zero charge on a miss)', failIdx > 0 && debitIdx > failIdx, `fail@${failIdx} debit@${debitIdx}`);
check('streams audio back (audio/mpeg)', /audio\/mpeg/.test(route));

// --- 4. Client SpeakButton wiring -----------------------------------------------------------
console.log('\n--- 4. SpeakButton (client) wiring ---');
const btn = read('../components/SpeakButton.tsx');
check('hits the /api/tts route', /fetch\('\/api\/tts'/.test(btn));
check('falls back to Web Speech when ElevenLabs is unavailable', /speakWebSpeech/.test(btn) && /speechSynthesis/.test(btn));
check('respects the mute setting (hides when muted)', /useVoiceMuted/.test(btn) && /if \(muted\) return null/.test(btn));
check('caches audio per message (no re-charge on replay)', /cacheRef/.test(btn) && /URL\.createObjectURL/.test(btn));
// No autoplay: playback is only reachable via the click handler, and there's no autoplay
// attribute/assignment nor a play() call wired into mount (useEffect).
check('never autoplays — only plays on tap (toggle)',
  /onClick=\{toggle\}/.test(btn) && !/autoplay\s*[=:]/i.test(btn) && !/useEffect\([^)]*\bplay\(\)/.test(btn));
check('exposes the audio element for the presence orb seam', /surge:voice/.test(btn));

// --- 5. Internal bypass is real (hours.mjs) -------------------------------------------------
console.log('\n--- 5. Internal bypass ---');
const hours = read('../lib/hours.mjs');
check('debitHours no-ops for internal accounts', /isInternal\(supabase, companyId\)/.test(hours) && /never charged/.test(hours));

// --- 6. (Gated) live ElevenLabs reachability ------------------------------------------------
console.log('\n--- 6. Live ElevenLabs (gated on ELEVENLABS_API_KEY) ---');
if (!isTtsConfigured()) {
  console.log('SKIP  live voice call — ELEVENLABS_API_KEY not set (add it to .env.local + Vercel to light the real voices)');
} else {
  try {
    const v = voiceFor('atlas');
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${v.voiceId}/stream?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY.trim(), 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text: 'Systems online.', model_id: TTS_MODEL, voice_settings: v.settings }),
    });
    check('ElevenLabs returns audio for the Atlas voice', r.ok && /audio/.test(r.headers.get('content-type') || ''), `status ${r.status}`);
  } catch (e) {
    check('ElevenLabs reachable', false, e.message);
  }
}

console.log(failures === 0
  ? '\nJARVIS-VOICE VERIFICATION PASSED — four distinct ElevenLabs voices, metered per character, internal bypass, charge-zero-on-failure, graceful fallback + mute.'
  : `\n${failures} CHECK(S) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
