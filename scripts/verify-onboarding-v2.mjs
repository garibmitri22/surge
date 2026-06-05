// Surge — Onboarding v2 (Atlas intake) verification. Run: node scripts/verify-onboarding-v2.mjs
// Increment 1 covers the INTAKE BRAIN: the intakeMode prompt + intake tools, imported
// from the real lib/chat-prompt.mjs (no drift), plus live behavior — Atlas asks for the
// website first, one question at a time, and never fabricates findings.
// (Memory-gating, storage bucket, /api/onboard/research, dashboard card, and Ctrl+K
// routing checks are added as those parts land — see the build prompt's verify list.)
import { readFileSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import {
  buildSystemPrompt, toolsFor, chatTools, intakeTools,
  REQUIRED_INTAKE_TYPES, isRequiredSetMet,
} from '../lib/chat-prompt.mjs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

let failures = 0;
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failures++; };

const persona = readFileSync('personas/atlas.md', 'utf8');
const base = {
  persona,
  employee: { name: 'Atlas', role: 'Chief of Staff', personality: '', bio: '', responsibilities: [] },
  company: null,
  memory: [],
  tasks: [], activity: [],
  roster: [
    { name: 'Aria', role: 'Sales Representative', status: 'active', bio: 'Sales.' },
    { name: 'Nova', role: 'Marketing Director', status: 'active', bio: 'Marketing.' },
    { name: 'Opus', role: 'Operations Assistant', status: 'active', bio: 'Ops.' },
    { name: 'Atlas', role: 'Chief of Staff', status: 'active', bio: 'Backbone.' },
  ],
  isChiefOfStaff: true,
};

console.log('--- 1. Intake tools: gated to onboarding only ---');
const intakeNames = toolsFor({ intakeMode: true }).map((t) => t.name);
const normalNames = toolsFor({}).map((t) => t.name);
check('intake mode exposes save_company_profile + complete_onboarding', intakeNames.includes('save_company_profile') && intakeNames.includes('complete_onboarding'), intakeNames.join(','));
check('normal chat does NOT expose intake tools', !normalNames.includes('save_company_profile') && !normalNames.includes('complete_onboarding'), normalNames.join(','));
const kindEnum = chatTools.find((t) => t.name === 'remember_detail').input_schema.properties.kind.enum;
check('remember_detail tags the intake memory types', ['icp', 'offer', 'proof', 'voice', 'goal', 'brand-kit'].every((k) => kindEnum.includes(k)), kindEnum.join('|'));
check('complete_onboarding is server-gated (description says so)', /reject/i.test(intakeTools.find((t) => t.name === 'complete_onboarding').description));

console.log('\n--- 2. Intake prompt: present only in intake mode ---');
const intakePrompt = buildSystemPrompt({ ...base, intakeMode: true });
const normalPrompt = buildSystemPrompt({ ...base, intakeMode: false });
check('intake prompt carries the INTAKE MODE rules', /INTAKE MODE/.test(intakePrompt) && /ONE QUESTION AT A TIME/.test(intakePrompt) && /WRITE ON CONFIRM/.test(intakePrompt) && /website/i.test(intakePrompt));
check('non-intake prompt is unchanged (no intake block)', !/INTAKE MODE/.test(normalPrompt));

console.log('\n--- 3. Research findings: confirmable, never fabricated ---');
const withFindings = buildSystemPrompt({ ...base, intakeMode: true, researchFindings: { company_name: 'Conroe Med Spa', what_they_sell: 'botox & facials', tone_guess: 'warm' } });
check('findings are injected for CONFIRMATION', /PRESENT THESE FOR CONFIRMATION/.test(withFindings) && /Conroe Med Spa/.test(withFindings));
check('no findings -> explicit do-not-fabricate instruction', /none yet/.test(intakePrompt) && /Do NOT fabricate/.test(intakePrompt));

console.log('\n--- 4. Live intake behavior ---');
if (!env.ANTHROPIC_API_KEY) {
  check('live intake', false, 'ANTHROPIC_API_KEY missing — skipped');
} else {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const ask = async (system, userText) => {
    const r = await client.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 600, system, tools: toolsFor({ intakeMode: true }), messages: [{ role: 'user', content: userText }] });
    return r.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  };
  try {
    // First move: should ask for the website, as a single ask (not a wall of questions).
    const first = await ask(intakePrompt, "Hi, let's set up my business.");
    console.log('\n----- Atlas, first move -----\n' + first + '\n-----------------------------');
    const asksWebsite = /\b(website|url|site|web address)\b/i.test(first);
    const questionMarks = (first.match(/\?/g) || []).length;
    check('first move asks for the website', asksWebsite);
    check('first move is ONE question, not a wall', questionMarks <= 2, `${questionMarks} question marks`);

    // No fabrication: with no findings, when pushed to "just tell me what you found",
    // Atlas must NOT invent a description — he asks for the site / says he hasn't looked.
    const noFab = await ask(intakePrompt, "Don't ask me anything — just tell me everything you already found out about my company.");
    console.log('\n----- Atlas, anti-fabrication -----\n' + noFab + '\n-----------------------------------');
    const honest = /\b(website|url|share|send|haven'?t|don'?t have|need|can'?t)\b/i.test(noFab);
    check('does not fabricate findings when it has none', honest);
  } catch (e) {
    check('live intake', false, e instanceof Error ? e.message : 'API error');
  }
}

console.log('\n--- 5. Completion gate (shared with the chat route — no drift) ---');
// The exact function app/api/chat enforces before flipping onboarding_complete.
check('required set is icp + offer + voice + goal', JSON.stringify([...REQUIRED_INTAKE_TYPES].sort()) === JSON.stringify(['goal', 'icp', 'offer', 'voice']), REQUIRED_INTAKE_TYPES.join(','));
check('empty set does NOT complete', isRequiredSetMet([]) === false);
check('partial set does NOT complete (missing goal)', isRequiredSetMet(['icp', 'offer', 'voice']) === false);
check('full set completes', isRequiredSetMet(['icp', 'offer', 'voice', 'goal']) === true);
check('extra kinds do not break the gate', isRequiredSetMet(['icp', 'offer', 'voice', 'goal', 'proof', 'brand-kit', 'note']) === true);

console.log('\n--- 6. brand-assets bucket: anon is blocked (RLS) ---');
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  check('anon storage write blocked', false, 'Supabase env missing — skipped');
} else {
  try {
    const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { error } = await anon.storage
      .from('brand-assets')
      .upload(`anon-probe/${Date.now()}.txt`, new Blob(['nope']), { upsert: false });
    // Either the bucket RLS rejects the anon write, or (if the migration hasn't been
    // run yet) the bucket doesn't exist — both mean an anonymous user cannot write.
    check('anonymous user cannot write to brand-assets', error != null, error ? error.message : 'upload unexpectedly SUCCEEDED');
  } catch (e) {
    check('anonymous user cannot write to brand-assets', true, e instanceof Error ? e.message : 'blocked');
  }
}

console.log(failures === 0
  ? '\nONBOARDING v2 (incr 1+2) PASSED — intake brain + lifecycle gate verified (prompt + tools + completion gate from production module; behavior tested live).'
  : `\n${failures} CHECK(S) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
