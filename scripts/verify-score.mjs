// Surge — Workforce Performance Score formula verification. Run: node scripts/verify-score.mjs
// Pure + deterministic (imports the production formula). Proves the score is REAL +
// honest: a fresh workspace scores null (no fake number), real work produces a real
// 0-100, weights renormalize over available lanes, and going quiet lowers momentum.
import { computeWorkforceScore, SCORE_WEIGHTS } from '../lib/score.mjs';

let failures = 0;
const check = (n, ok, d) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); if (!ok) failures++; };

console.log('--- Workforce Score formula ---');

const fresh = computeWorkforceScore({});
check('fresh workspace scores null (never a fake number)', fresh.score === null && fresh.hasEnoughData === false, JSON.stringify(fresh));

const oneTask = computeWorkforceScore({ tasksCompleted: 1, tasksOpen: 0 });
check('one completed task is enough to start scoring', oneTask.hasEnoughData === true && typeof oneTask.score === 'number');

const strong = computeWorkforceScore({ tasksCompleted: 9, tasksOpen: 1, leadsTotal: 20, leadsQualified: 20, recentWork: 12 });
check('strong real work scores high (>=80)', strong.score >= 80, `score ${strong.score}`);
check('score is bounded 0-100', strong.score <= 100 && strong.score >= 0);

const weak = computeWorkforceScore({ tasksCompleted: 1, tasksOpen: 9, leadsTotal: 5, leadsQualified: 0, recentWork: 0 });
check('weak execution + quiet momentum scores low (<40)', weak.score < 40, `score ${weak.score}`);

// No-leads team isn't penalized for the pipeline lane it hasn't touched (renormalize).
const noLeads = computeWorkforceScore({ tasksCompleted: 4, tasksOpen: 0, leadsTotal: 0, recentWork: 5 });
check('no-leads team renormalizes (no pipeline component)', !noLeads.components.some(c => c.key === 'pipeline') && noLeads.score > 0, noLeads.components.map(c => c.key).join(','));

// Going quiet (no recent work) lowers an otherwise-strong team.
const busy = computeWorkforceScore({ tasksCompleted: 10, tasksOpen: 0, leadsTotal: 20, leadsQualified: 20, recentWork: 12 });
const quiet = computeWorkforceScore({ tasksCompleted: 10, tasksOpen: 0, leadsTotal: 20, leadsQualified: 20, recentWork: 0 });
check('going quiet lowers the score (momentum counts)', quiet.score < busy.score, `quiet ${quiet.score} < busy ${busy.score}`);

check('weights are the documented 40/35/25', SCORE_WEIGHTS.execution === 0.40 && SCORE_WEIGHTS.pipeline === 0.35 && SCORE_WEIGHTS.momentum === 0.25);

console.log(failures === 0 ? '\nSCORE FORMULA PASSED — real, bounded, honest (null until there is real work).' : `\n${failures} CHECK(S) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
