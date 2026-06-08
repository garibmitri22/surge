// Surge — one-time provisioning of the ElevenLabs "Atlas" Agent (JARVIS Phase 3).
// Run once with your ElevenLabs key in .env.local:  node scripts/provision-atlas-agent.mjs
//
// Creates a private agent wired to Atlas's voice, with per-session OVERRIDES enabled (so the app
// can inject Atlas's live system prompt + greeting at startSession). Prints the agent_id to set
// as ELEVENLABS_AGENT_ID. For the FULL "do-things" brain, point the agent's LLM at our custom
// webhook (URL + secret below) — see the printed next steps.
import { readFileSync } from 'node:fs';
import { voiceFor, TTS_MODEL } from '../lib/voices.mjs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const KEY = env.ELEVENLABS_API_KEY;
const APP_URL = env.NEXT_PUBLIC_APP_URL || 'https://surgehq.io';
if (!KEY) { console.log('Set ELEVENLABS_API_KEY in .env.local first. Exiting.'); process.exit(1); }

const atlas = voiceFor('atlas');
const body = {
  name: 'Atlas — Surge Chief of Staff',
  conversation_config: {
    agent: {
      // Placeholder — the app OVERRIDES prompt + first_message per session with Atlas's live brain.
      prompt: { prompt: 'You are Atlas, a calm, concise chief of staff. Keep replies to one to three spoken sentences.' },
      first_message: 'Hey, Atlas here. What do you want to move first?',
      language: 'en',
    },
    tts: { voice_id: atlas.voiceId, model_id: TTS_MODEL },
  },
  // Allow the client to override these at startSession (otherwise injection is ignored).
  platform_settings: {
    overrides: {
      conversation_config_override: {
        agent: { prompt: { prompt: true }, first_message: true, language: true },
        tts: { voice_id: true },
      },
    },
  },
};

const res = await fetch('https://api.elevenlabs.io/v1/convai/agents/create', {
  method: 'POST',
  headers: { 'xi-api-key': KEY.trim(), 'content-type': 'application/json' },
  body: JSON.stringify(body),
});
const json = await res.json().catch(() => ({}));
if (!res.ok) {
  console.log(`Create failed (HTTP ${res.status}):`, JSON.stringify(json, null, 2));
  console.log('\nIf the API shape has shifted, create the agent in the ElevenLabs dashboard instead:');
  console.log('  Agents → New → voice = Atlas (' + atlas.voiceId + '), enable Overrides for System prompt + First message + Voice.');
  process.exit(1);
}

const agentId = json.agent_id || json.agentId || json.id;
console.log('\n✅ Atlas agent created.');
console.log('   agent_id:', agentId);
console.log('\nNEXT STEPS:');
console.log('  1. Set in Vercel + .env.local:   ELEVENLABS_AGENT_ID=' + agentId);
console.log('  2. (Full brain) In the ElevenLabs dashboard → this agent → LLM → "Custom LLM":');
console.log('       Server URL:  ' + APP_URL + '/api/voice/llm');
console.log('       API key:     <your VOICE_LLM_SECRET>   (set the same value in Vercel env)');
console.log('     This routes every turn through Atlas\'s real Claude brain (with tools).');
console.log('     Without it, the agent still TALKS with Atlas\'s live context — it just can\'t run tools.');
console.log('  3. Ensure SUPABASE_SERVICE_ROLE_KEY is set in Vercel (the webhook writes with it).');
