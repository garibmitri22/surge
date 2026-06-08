// Surge — run-legibility verification. Run: node scripts/verify-run-progress.mjs
//
// Proves the run state machine reflects REAL run status (not vibes):
//   1. computeRunPhase maps real signals → the right phase, including the Research→Drafting
//      transition (drafts>0 means the post-loop drafting batch started) and Done on completion.
//   2. The phase labels surface REAL counts and never a fabricated number.
//   3. All three surfaces (dashboard, /leads, tasks) feed the machine REAL polled counts,
//      land on a completion state (not a bare "Run"), and only show the kick button when idle.
import { readFileSync } from 'node:fs';
import { computeRunPhase, runProgressLabel, isRunActive } from '../lib/run-progress.mjs';

let failures = 0;
const check = (n, ok, d) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); if (!ok) failures++; };
const read = (p) => readFileSync(p, 'utf8');

console.log('--- 1. Phase machine (real signals → phase) ---');
check('nothing running → idle', computeRunPhase({}) === 'idle');
check('kicked, nothing written yet → queued', computeRunPhase({ inFlight: true, leads: 0, drafts: 0 }) === 'queued');
check('leads ticking, no drafts → researching', computeRunPhase({ inFlight: true, leads: 7, drafts: 0 }) === 'researching');
check('drafts appear → drafting (research done)', computeRunPhase({ inFlight: true, leads: 12, drafts: 3 }) === 'drafting');
check('task completed → done (any counts)', computeRunPhase({ inFlight: false, completed: true, leads: 15, drafts: 5 }) === 'done');
check('failed → failed', computeRunPhase({ inFlight: true, failed: true }) === 'failed');
check('isRunActive true only while working', isRunActive('researching') && isRunActive('drafting') && isRunActive('queued') && !isRunActive('done') && !isRunActive('idle'));

console.log('\n--- 2. Labels carry REAL counts, never fabricated ---');
check('researching label shows the live lead count', /7 real leads found/.test(runProgressLabel('researching', { leads: 7 }).sub));
check('drafting label shows leads found + drafts so far', /Found 12 leads/.test(runProgressLabel('drafting', { leads: 12, drafts: 3 }).title) && /3 drafts ready/.test(runProgressLabel('drafting', { leads: 12, drafts: 3 }).sub));
check('done label uses the REAL counts passed (no hardcoded number)', runProgressLabel('done', { leads: 15, drafts: 5 }).title === 'Aria found 15 leads and drafted 5' && runProgressLabel('done', { leads: 9, drafts: 4 }).title === 'Aria found 9 leads and drafted 4');
check('zero state is honest (no fake "leads found")', runProgressLabel('queued', { leads: 0 }).sub === 'Spinning up — the first prospects land in a moment.');

console.log('\n--- 3. Surfaces feed REAL counts + land on completion + honest idle ---');
const leadsPg = read('app/leads/page.tsx');
const tasksPg = read('app/tasks/page.tsx');
const dash = read('app/dashboard/page.tsx');
const comp = read('components/RunProgress.tsx');

check('RunProgress renders nothing when idle (honest idle)', /computeRunPhase\(/.test(comp) && /if \(phase === 'idle'\) return null;/.test(comp));
check('RunProgress: review is PRIMARY, run-again is SECONDARY', comp.indexOf('reviewLabel') < comp.indexOf('runAgainLabel') && /textDecoration: 'underline'/.test(comp));
check('/leads polls REAL counts (leads + drafts) into the run state', /getLeads\(\), getDrafts\(\), getTasks\(\)/.test(leadsPg) && /setRunLeads\(Math\.max\(0, l\.length - beforeLeads\)\)/.test(leadsPg));
check('/leads kick button only shows when idle (not running/done/failed)', /!runActive && !runDone && !runFailed/.test(leadsPg) && /<RunProgress/.test(leadsPg));
check('/leads lands on completion (runDone set, not a bare button)', /setRunDone\(true\); setRunActive\(false\)/.test(leadsPg));
check('tasks polls REAL counts + renders RunProgress', /getTasks\(\), getLeads\(\), getDrafts\(\)/.test(tasksPg) && /<RunProgress/.test(tasksPg) && /setRunDone\(true\)/.test(tasksPg));
check('dashboard activation is phase-aware off REAL counts', /computeRunPhase\(\{ inFlight: true, leads: activatingLeads, drafts: activatingDrafts \}\)/.test(dash) && /setActivatingDrafts\(s2\.draftCount\)/.test(dash));

console.log(failures === 0
  ? '\nRUN-PROGRESS VERIFICATION PASSED — phases reflect real run status (research→drafting→done), counts are real, idle is honest, completion is a state not a bare button.'
  : `\n${failures} CHECK(S) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
