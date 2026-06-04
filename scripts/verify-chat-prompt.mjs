// Surge — HQ Chat prompt behavior check.
// Verifies: when asked to research leads, Aria routes it to a task and points to
// the Run button — and NEVER claims a missing/"not connected" integration.
// Imports the REAL production prompt + tools from lib/chat-prompt.mjs (same module
// app/api/chat/route.ts uses), so this test cannot drift from production.
// Run: node scripts/verify-chat-prompt.mjs
import { readFileSync } from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt, chatTools } from '../lib/chat-prompt.mjs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const KEY = env.ANTHROPIC_API_KEY;
if (!KEY) { console.error('FAIL: ANTHROPIC_API_KEY missing'); process.exit(1); }

const MODEL = 'claude-sonnet-4-6';
const persona = readFileSync(path.join('personas', 'aria.md'), 'utf8');

// Representative live context (Surge is customer #1). Tasks/activity intentionally
// empty so a "I haven't started work yet" honesty path is available too.
const system = buildSystemPrompt({
  persona,
  employee: { name: 'Aria', role: 'Sales Representative', personality: '', bio: '', responsibilities: [] },
  company: {
    company_name: 'Surge',
    industry: 'AI Workforce Platform (SaaS)',
    target_customers: 'business owners with 1-20 employees, $500K-$5M revenue, frustrated with hiring costs/turnover',
    brand_tone: 'sharp, direct, confident, human',
    main_goal: 'book qualified meetings for the $299/mo AI employee',
    competitors: 'Jasper, Copy.ai, Relevance AI',
    employee_count: 3,
  },
  memory: [{ type: 'process', title: 'ICP', content: 'med spas, real estate, gyms in North Houston up to Conroe' }],
  tasks: [],
  activity: [],
  roster: [
    { name: 'Aria', role: 'Sales Representative', status: 'active', bio: '' },
    { name: 'Nova', role: 'Marketing', status: 'active', bio: '' },
    { name: 'Opus', role: 'Operations', status: 'active', bio: '' },
  ],
});

const client = new Anthropic({ apiKey: KEY });
const convo = [];
let createdTask = null;

// Run one user turn, executing tools (stubbed) until the model stops asking. Returns text.
async function turn(userText) {
  convo.push({ role: 'user', content: userText });
  let text = '';
  for (let i = 0; i < 5; i++) {
    const resp = await client.messages.create({ model: MODEL, max_tokens: 1024, system, tools: chatTools, messages: convo });
    convo.push({ role: 'assistant', content: resp.content });
    text = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('') || text;
    if (resp.stop_reason === 'tool_use') {
      const results = [];
      for (const b of resp.content) {
        if (b.type === 'tool_use') {
          if (b.name === 'create_task') createdTask = b.input;
          results.push({ type: 'tool_result', tool_use_id: b.id, content: b.name === 'create_task' ? `Task created and assigned to you: "${b.input.title}".` : 'Saved.' });
        }
      }
      convo.push({ role: 'user', content: results });
      continue;
    }
    break;
  }
  return text;
}

const FORBIDDEN = [/not connected/i, /isn'?t connected/i, /talk to mitri/i, /a developer|an engineer/i, /can'?t (research|browse|find leads)/i, /research_web/i, /integration (is|isn'?t|needs)/i];

const t1 = await turn('Can you research and qualify the top 50 med spas in north Houston up to Conroe for me?');
console.log('\n========== TURN 1 — owner asks Aria to research leads ==========\n' + t1);
const createdTaskBeforeApproval = !!createdTask;

const t2 = await turn('Yes, do it.');
console.log('\n========== TURN 2 — owner approves ==========\n' + t2);
if (createdTask) console.log('\n[create_task called] -> ' + JSON.stringify(createdTask));

// ---- Verdict --------------------------------------------------------------
let failures = 0;
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failures++; };
console.log('\n========== VERDICT ==========');
const allText = (t1 + '\n' + t2);
const hit = FORBIDDEN.find((re) => re.test(allText));
check('never claims a missing/"not connected" integration', !hit, hit ? `matched ${hit}` : 'clean');
check('turn 1 proposes a plan + asks approval (no premature task)', !createdTaskBeforeApproval, 'task not created before "yes"');
check('creates the task after approval', !!createdTask, createdTask ? `title: ${createdTask.title}` : 'create_task never called');
check('points the owner to Run / the Tasks page', /\brun\b/i.test(t2) || /tasks page/i.test(t2), 'mentions Run/Tasks page');

console.log(failures === 0 ? '\nALL CHECKS PASSED — chat prompt fix verified live (production prompt imported, not mirrored).' : `\n${failures} CHECK(S) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
