// Surge — JARVIS listening (Phase 2): server-side speech-to-text via Deepgram.
//
// WHY DEEPGRAM (decided June 7): streaming-native, lowest-latency real-time STT — what the
// voice-agent platforms (Vapi/Retell) use under the hood, ~$0.005/min. This slice transcribes
// a short recorded utterance (the dictation upgrade); the real-time STREAMING socket lands with
// the conversation/calls slice on the SAME vendor. Whisper is reserved for batch RECORDINGS
// later (voicemails, call summaries) — not live.
//
// ONE home for the STT config so no provider detail leaks into a component. Model is
// env-overridable so it can be re-tuned without a deploy. .mjs so the TS route AND the
// node verify scripts share one source of truth.

const env = (k, fallback) => {
  const v = process.env[k];
  return v && String(v).trim() ? String(v).trim() : fallback;
};

export const STT_PROVIDER = 'deepgram';
export const STT_MODEL = env('DEEPGRAM_MODEL', 'nova-2'); // nova-2: accurate + fast; override via env

/** Deepgram prerecorded endpoint with sane defaults (punctuation + smart formatting). */
export function deepgramListenUrl() {
  const p = new URLSearchParams({ model: STT_MODEL, smart_format: 'true', punctuate: 'true' });
  return `https://api.deepgram.com/v1/listen?${p.toString()}`;
}

/** True only when the Deepgram key is present — the route returns 503 otherwise and the
 *  client falls back to the free browser dictation, so the mic never breaks without a key. */
export function isSttConfigured() {
  return Boolean(process.env.DEEPGRAM_API_KEY && String(process.env.DEEPGRAM_API_KEY).trim());
}

/** Pull the best transcript out of a Deepgram response (empty string if it heard nothing). */
export function extractTranscript(json) {
  try {
    return String(json?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '').trim();
  } catch {
    return '';
  }
}

/** Audio duration (seconds) Deepgram actually processed — what we meter on. 0 if absent. */
export function extractDuration(json) {
  const d = Number(json?.metadata?.duration);
  return Number.isFinite(d) && d > 0 ? d : 0;
}
