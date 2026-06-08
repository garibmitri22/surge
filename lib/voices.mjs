// Surge — JARVIS voice (Phase 1): per-agent ElevenLabs TTS config.
//
// ONE home for the voice mapping so no voice id is ever hardcoded in a component.
// Each employee gets a DISTINCT voice matched to their persona (personas/*.md):
//   Atlas — deep, calm, steady (the JARVIS voice)
//   Aria  — crisp, confident
//   Nova  — warm, energetic
//   Opus  — measured, precise
//
// Voice ids are env-overridable (ELEVENLABS_VOICE_ATLAS, …) so Mitri can re-tune the
// cast WITHOUT a code change/deploy — defaults are stable public Voice-Library ids.
// .mjs so the server route (TS) AND the verify scripts (node) share one source of truth.

const env = (k, fallback) => {
  const v = process.env[k];
  return v && String(v).trim() ? String(v).trim() : fallback;
};

// Flash = lowest latency + lowest $/char where quality holds — the right pick for a
// short spoken reply that should START fast. Override with ELEVENLABS_MODEL if needed.
export const TTS_MODEL = env('ELEVENLABS_MODEL', 'eleven_flash_v2_5');
export const TTS_OUTPUT_FORMAT = env('ELEVENLABS_OUTPUT_FORMAT', 'mp3_44100_128');

// employeeId -> voice. voice_settings shape per ElevenLabs: stability (consistency),
// similarity_boost (closeness to the source voice), style (expressiveness), speed.
export const VOICES = {
  atlas: {
    name: 'Atlas',
    character: 'smooth, trustworthy, steady — the JARVIS voice',
    // Eric — matches the live ElevenLabs conversational agent so click-to-play TTS and the live
    // conversation are the SAME Atlas. Override with ELEVENLABS_VOICE_ATLAS if your Eric id differs.
    voiceId: env('ELEVENLABS_VOICE_ATLAS', 'cjVigY5qzO86Huf0OWal'),
    settings: { stability: 0.6, similarity_boost: 0.75, style: 0.0, speed: 0.96, use_speaker_boost: true },
  },
  aria: {
    name: 'Aria',
    character: 'confident, warm, sales-ready — sounds ready to pick up the phone and close',
    // Aria — confident, warm, persuasive American female. Reads like a real sales rep, not a demo
    // narrator. Override with ELEVENLABS_VOICE_ARIA to swap from your ElevenLabs library.
    voiceId: env('ELEVENLABS_VOICE_ARIA', '9BWtsMINqrJLrRacOk9x'),
    settings: { stability: 0.5, similarity_boost: 0.8, style: 0.25, speed: 1.0, use_speaker_boost: true },
  },
  nova: {
    name: 'Nova',
    character: 'warm, energetic',
    voiceId: env('ELEVENLABS_VOICE_NOVA', 'EXAVITQu4vr4xnSDxMaL'), // Bella — bright, friendly, lively
    settings: { stability: 0.4, similarity_boost: 0.8, style: 0.3, speed: 1.06, use_speaker_boost: true },
  },
  opus: {
    name: 'Opus',
    character: 'deep, measured, grounded — a steady operator, not a hype voice',
    // Brian — deep, mature, professional American male. Calm and precise (replaces the young/casual
    // read). Override with ELEVENLABS_VOICE_OPUS to swap from your ElevenLabs library.
    voiceId: env('ELEVENLABS_VOICE_OPUS', 'nPczCjzI2devNBz1zQrb'),
    settings: { stability: 0.72, similarity_boost: 0.75, style: 0.0, speed: 0.97, use_speaker_boost: true },
  },
};

export const VOICE_EMPLOYEES = Object.keys(VOICES);
export const DEFAULT_VOICE_EMPLOYEE = 'atlas'; // anyone unmapped speaks in the house JARVIS voice

/** The voice config for an employee, falling back to the JARVIS (Atlas) voice. */
export function voiceFor(employeeId) {
  return VOICES[employeeId] || VOICES[DEFAULT_VOICE_EMPLOYEE];
}

/** True only when the ElevenLabs key is present — the route returns 503 otherwise and the
 *  client falls back to the free Web-Speech voice, so the UI never breaks without a key. */
export function isTtsConfigured() {
  return Boolean(process.env.ELEVENLABS_API_KEY && String(process.env.ELEVENLABS_API_KEY).trim());
}

/** The ElevenLabs Agents "Atlas" agent id (real-time conversation, Phase 3). Set after the
 *  provisioning script runs. Env so the agent can be swapped without a deploy. */
export function agentId() {
  const v = process.env.ELEVENLABS_AGENT_ID;
  return v && String(v).trim() ? String(v).trim() : '';
}

/** Real-time hands-free voice is live only when BOTH the key and the agent id are present.
 *  Otherwise /api/voice/session returns 503 and the dashboard hides the live-voice control. */
export function isAgentConfigured() {
  return Boolean(isTtsConfigured() && agentId());
}

/** Strip markdown / emoji / code so the voice reads natural prose, not "asterisk asterisk".
 *  Shared by the server route AND the client button so both clean text identically. */
export function forSpeech(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, ' code block ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [label](url) -> label
    .replace(/[*_`#>]/g, '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}
