// Surge — THE SINGLE SOURCE OF TRUTH for agent voices. employeeId → { voiceId (ElevenLabs
// voice), agentId (ElevenLabs Conversational agent), settings }. NOTHING anywhere else may
// hardcode a voice id or agent id — every voice surface reads from here:
//   • the app's per-agent click-to-play TTS (app/api/tts)
//   • the landing + agent-page voice demos (→ /api/tts)
//   • the live ElevenLabs Conversational agents (app/api/voice/session reads agentId here;
//     scripts/provision-atlas-agent.mjs sets the agent's voice FROM voiceId here)
// → one id per agent, identical on landing, in the app, and in a live conversation. No drift.
//
// Atlas's voiceId is ERIC — the exact voice his published ConvAI agent uses — so click-to-play
// and the live call are the same Atlas. Same one-voice rule for Aria, Nova, Opus.
//
// Everything is env-overridable (ELEVENLABS_VOICE_<AGENT>, ELEVENLABS_AGENT_ID_<AGENT>) so the
// cast can be re-tuned without a code change. .mjs so server routes (TS) AND node verify/provision
// scripts share the SAME module — that shared import is what guarantees no surface can drift.

const env = (k, fallback) => {
  const v = process.env[k];
  return v && String(v).trim() ? String(v).trim() : fallback;
};

// Flash = lowest latency + lowest $/char where quality holds — the right pick for a
// short spoken reply that should START fast. Override with ELEVENLABS_MODEL if needed.
export const TTS_MODEL = env('ELEVENLABS_MODEL', 'eleven_flash_v2_5');
export const TTS_OUTPUT_FORMAT = env('ELEVENLABS_OUTPUT_FORMAT', 'mp3_44100_128');

// employeeId -> { voiceId, agentId, settings }. voice_settings shape per ElevenLabs: stability
// (consistency), similarity_boost (closeness to the source voice), style (expressiveness), speed.
// agentId = the employee's live ElevenLabs Conversational agent (only Atlas is published today;
// the slot is here so the others wire in identically when they get one). Atlas's agent id also
// honours the legacy ELEVENLABS_AGENT_ID for back-compat.
export const VOICES = {
  atlas: {
    name: 'Atlas',
    character: 'smooth, trustworthy, steady — the JARVIS voice',
    voiceId: env('ELEVENLABS_VOICE_ATLAS', 'cjVigY5qzO86Huf0OWal'), // Eric — SAME as his live ConvAI agent
    agentId: env('ELEVENLABS_AGENT_ID_ATLAS', '') || env('ELEVENLABS_AGENT_ID', ''),
    settings: { stability: 0.6, similarity_boost: 0.75, style: 0.0, speed: 0.96, use_speaker_boost: true },
  },
  aria: {
    name: 'Aria',
    character: 'a real inside-sales rep on the phone — warm, confident, conversational, persuasive',
    // Jessica — natural, conversational American female built for DIALOGUE, not narration. Aria's job
    // is talking to leads and booking appointments, so she should sound like a person on a call.
    voiceId: env('ELEVENLABS_VOICE_ARIA', 'cgSgspJ2msm6clMCkdW9'),
    agentId: env('ELEVENLABS_AGENT_ID_ARIA', ''),
    settings: { stability: 0.45, similarity_boost: 0.8, style: 0.3, speed: 1.0, use_speaker_boost: true },
  },
  nova: {
    name: 'Nova',
    character: 'warm, energetic',
    voiceId: env('ELEVENLABS_VOICE_NOVA', 'EXAVITQu4vr4xnSDxMaL'), // Bella — bright, friendly, lively
    agentId: env('ELEVENLABS_AGENT_ID_NOVA', ''),
    settings: { stability: 0.4, similarity_boost: 0.8, style: 0.3, speed: 1.06, use_speaker_boost: true },
  },
  opus: {
    name: 'Opus',
    character: 'deep, measured, grounded — a steady operator, not a hype voice',
    voiceId: env('ELEVENLABS_VOICE_OPUS', 'nPczCjzI2devNBz1zQrb'), // Brian — deep, mature, professional
    agentId: env('ELEVENLABS_AGENT_ID_OPUS', ''),
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

/** The live ElevenLabs Conversational agent id for an employee (from the config above). */
export function agentIdFor(employeeId) {
  return (VOICES[employeeId] || VOICES[DEFAULT_VOICE_EMPLOYEE]).agentId || '';
}

/** Back-compat: the Atlas agent id (the only published one today). */
export function agentId() {
  return agentIdFor('atlas');
}

/** Real-time hands-free voice is live for an employee only when BOTH the key and that employee's
 *  agent id are present. Otherwise /api/voice/session returns 503 and the live control hides. */
export function isAgentConfigured(employeeId = 'atlas') {
  return Boolean(isTtsConfigured() && agentIdFor(employeeId));
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
