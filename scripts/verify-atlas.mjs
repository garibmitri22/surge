// Surge — Atlas (Chief of Staff) verification. Run: node scripts/verify-atlas.mjs
// Proves: (1) persona exists, (2) tools route work + tag memory, (3) Atlas's prompt
// shows the WHOLE board (all employees' tasks, pipeline, snapshot) while other
// employees' prompts are UNCHANGED, (4) the route detects the chief and loads
// cross-team data, (5) the Atlas employee row is seeded. Imports the REAL
// lib/chat-prompt.mjs and greps production source so checks can't pass on a mirror.
// Ends with one live morning-brief call (needs ANTHROPIC_API_KEY).
import { readFileSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt, chatTools } from '../lib/chat-prompt.mjs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

let failures = 0;
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failures++; };

const persona = readFileSync('personas/atlas.md', 'utf8');
const route = readFileSync('app/api/chat/route.ts', 'utf8');
const schema = readFileSync('supabase/schema.sql', 'utf8');
const migration = readFileSync('supabase/atlas_migration.sql', 'utf8');

console.log('--- 1. Persona ---');
check('personas/atlas.md exists with Chief-of-Staff identity', /Chief of Staff/.test(persona) && /Morning Brief/.test(persona) && /Open-Loop/.test(persona) && /Zero Ego/i.test(persona));

console.log('\n--- 2. Tools: route work + tag memory ---');
const createTask = chatTools.find((t) => t.name === 'create_task');
const remember = chatTools.find((t) => t.name === 'remember_detail');
check('create_task can route to any teammate (assignee param)', !!createTask?.input_schema?.properties?.assignee);
const kindEnum = remember?.input_schema?.properties?.kind?.enum ?? [];
check('remember_detail tags decisions / open-loops / ideas (kind enum)', ['decision', 'open-loop', 'idea'].every((k) => kindEnum.includes(k)), kindEnum.join('|'));

console.log('\n--- 3. Whole-board view: chief sees all, others unchanged ---');
const base = {
  company: { company_name: 'Surge', industry: 'AI Workforce', target_customers: 'SMB owners', brand_tone: 'sharp', main_goal: 'revenue', competitors: 'none', employee_count: '4' },
  memory: [{ type: 'process', title: 'ICP', content: 'med spas N. Houston' }],
  activity: [],
  roster: [
    { name: 'Aria', role: 'Sales Representative', status: 'active', bio: 'Sales.' },
    { name: 'Nova', role: 'Marketing Director', status: 'active', bio: 'Marketing.' },
    { name: 'Opus', role: 'Operations Assistant', status: 'active', bio: 'Ops.' },
    { name: 'Atlas', role: 'Chief of Staff', status: 'active', bio: 'Backbone.' },
  ],
};
const allTasks = [
  { assignee_id: 'aria', title: 'Research med spas', status: 'in_progress', project: 'Outreach', due_date: '2026-06-06' },
  { assignee_id: 'nova', title: 'September content calendar', status: 'queued', project: 'Content', due_date: '2026-06-08' },
  { assignee_id: 'opus', title: 'Weekly performance report', status: 'queued', project: 'Ops', due_date: '2026-06-07' },
];
const leadPipeline = { total: 12, qualified: 7, drafted: 5, pendingDrafts: 5, overdue: 1 };
const kpiSnapshot = [{ employee: 'aria', open: 1, done: 2 }, { employee: 'nova', open: 1, done: 1 }, { employee: 'opus', open: 1, done: 3 }];

const atlasPrompt = buildSystemPrompt({
  ...base, persona, employee: { name: 'Atlas', role: 'Chief of Staff', personality: '', bio: '', responsibilities: [] },
  tasks: [], isChiefOfStaff: true, allTasks, leadPipeline, kpiSnapshot,
});
const ariaPrompt = buildSystemPrompt({
  ...base, persona: 'You are Aria.', employee: { name: 'Aria', role: 'Sales Representative', personality: '', bio: '', responsibilities: [] },
  tasks: [{ title: 'Research med spas', status: 'in_progress', project: 'Outreach', due_date: '2026-06-06' }],
});

check("Atlas sees teammates' tasks (cross-team)", /WHOLE-BOARD VIEW/.test(atlasPrompt) && /\[nova\] "September content calendar"/.test(atlasPrompt) && /\[opus\]/.test(atlasPrompt));
check('Atlas sees the lead pipeline summary', /12 leads — 7 qualified, 5 drafted, 5 draft\(s\) pending/.test(atlasPrompt));
check('Atlas sees the workforce snapshot', /WORKFORCE SNAPSHOT/.test(atlasPrompt) && /aria: 1 open, 2 done/.test(atlasPrompt));
check('Atlas gets Chief-of-Staff mode rule (morning brief + routing)', /CHIEF OF STAFF MODE/.test(atlasPrompt) && /Morning Brief/.test(atlasPrompt));
check('non-chief employees are UNCHANGED (no whole-board, no chief rule)', !/WHOLE-BOARD VIEW/.test(ariaPrompt) && !/CHIEF OF STAFF MODE/.test(ariaPrompt));

console.log('\n--- 4. Route wires the chief context ---');
check('route detects the Chief of Staff', /isChiefOfStaff\s*=\s*employee\.role === 'Chief of Staff'/.test(route));
check('route loads ALL employees\' tasks for the chief (not assignee-filtered)', /from\('tasks'\)\.select\('title, status, project, due_date, assignee_id'\)/.test(route) && /allTasks,/.test(route));
check('route resolves create_task assignee to any teammate', /input\.assignee/.test(route) && /assignee_id: assigneeId/.test(route));

console.log('\n--- 5. Atlas employee row seeded ---');
check('schema.sql fresh-install seed includes Atlas', /\('atlas', 'Atlas', 'Chief of Staff'/.test(schema));
check('atlas_migration.sql inserts Atlas idempotently', /Chief of Staff/.test(migration) && /on conflict \(id\) do update/.test(migration));

console.log('\n--- 6. Live morning brief ---');
if (!env.ANTHROPIC_API_KEY) {
  check('live morning brief', false, 'ANTHROPIC_API_KEY missing — skipped');
} else {
  try {
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const resp = await client.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 700,
      system: atlasPrompt, tools: chatTools, messages: [{ role: 'user', content: 'Morning.' }],
    });
    const text = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    console.log('\n----- Atlas, unprompted morning brief -----\n' + text + '\n-------------------------------------------');
    const mentionsTeam = /aria/i.test(text) && (/nova/i.test(text) || /opus/i.test(text));
    check('Atlas opens with a real morning brief referencing the team', text.length > 60 && mentionsTeam);
    check('no fabricated results (does not invent meetings/revenue not in data)', !/\b\d+\s+(meetings booked|deals closed)\b/i.test(text) && !/\$\d[\d,]*\s*(in pipeline|revenue|ARR)/i.test(text));
    // Voice rule (shared): even the morning brief shouldn't lean on em-dashes (max 1 by rule; fail at 3+).
    const emCount = (text.match(/—/g) || []).length;
    check('voice: morning brief stays under 3 em-dashes', emCount < 3, `${emCount} em-dashes`);
  } catch (e) {
    check('live morning brief', false, e instanceof Error ? e.message : 'API error');
  }
}

console.log('\n--- 7. Works the problem: surfaces a contradiction, no stock question ---');
if (!env.ANTHROPIC_API_KEY) {
  check('contradiction handling', false, 'ANTHROPIC_API_KEY missing — skipped');
} else {
  try {
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    // Filled brain with a built-in contradiction: the ICP on file is broad/high-ticket,
    // but the active GTM list is a specific set of verticals. A scripted agent asks
    // "who's your ICP?"; Atlas should NAME the conflict and ask which to follow.
    const contraPrompt = buildSystemPrompt({
      ...base, persona, employee: { name: 'Atlas', role: 'Chief of Staff', personality: '', bio: '', responsibilities: [] },
      tasks: [], isChiefOfStaff: true, allTasks: [], leadPipeline: null, kpiSnapshot: [],
      company: { ...base.company, target_customers: 'high-ticket business owners, intentionally kept broad' },
      memory: [
        { type: 'icp', title: 'ICP', content: 'high-ticket business owners, kept broad' },
        { type: 'process', title: 'GTM list', content: 'Active GTM target list: med spas, real estate, gyms, North Houston up to Conroe' },
      ],
    });
    const resp = await client.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 600,
      system: contraPrompt, tools: chatTools, messages: [{ role: 'user', content: 'Tell Aria who to target so she can start outreach.' }],
    });
    const text = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    console.log('\n----- Atlas, contradiction scenario -----\n' + text + '\n-----------------------------------------');
    const mentionsBoth = /high[\s-]?ticket/i.test(text) && /med spa/i.test(text);
    const stockQuestion = /who (is|are) your (ideal|target) (customer|client|audience)/i.test(text);
    check('surfaces the ICP-vs-GTM contradiction (names both)', mentionsBoth, mentionsBoth ? 'named both' : 'did not name both targets');
    check('does NOT fall back to a stock "who is your ICP?" question', !stockQuestion);
  } catch (e) {
    check('contradiction handling', false, e instanceof Error ? e.message : 'API error');
  }
}

console.log(failures === 0
  ? '\nALL CHECKS PASSED — Atlas verified (prompt + tools from production module; route wiring grepped; brief tested live).'
  : `\n${failures} CHECK(S) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
