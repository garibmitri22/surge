// Surge — Outcomes-first verification. Run: node scripts/verify-outcomes.mjs
//
// Proves the honesty rule:
//   1. Estimated Potential Pipeline = (qualified + warm) × avg deal value.
//   2. It's null (hidden) when avg deal value is unset/0 — NEVER a fabricated number.
//   3. Zero pipeline leads → $0 (honest), not hidden.
//   4. The dashboard hero + briefing use the SAME source (lib/data getWorkforceStats for
//      counts; the shared estimatePipeline for the money) — checked by grep.
//   5. NO hardcoded dollar figures in the dashboard hero or briefing render.
import { readFileSync } from 'node:fs';
import { estimatePipeline } from '../lib/briefing.mjs';

let failures = 0;
const check = (n, ok, d) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); if (!ok) failures++; };

console.log('--- 1. Pipeline math (the only money figure) ---');
check('3 qualified+warm × $15,000 = $45,000', estimatePipeline(3, 15000) === 45000);
check('12 × $2,500 = $30,000', estimatePipeline(12, 2500) === 30000);

console.log('\n--- 2. Hidden when avg deal value is unset (never fabricated) ---');
check('avg deal value null → null (no number)', estimatePipeline(5, null) === null);
check('avg deal value 0 → null', estimatePipeline(5, 0) === null);
check('avg deal value negative → null', estimatePipeline(5, -100) === null);
check('avg deal value undefined → null', estimatePipeline(5, undefined) === null);

console.log('\n--- 3. Zero leads is an honest $0, not hidden ---');
check('0 leads × $15,000 = 0', estimatePipeline(0, 15000) === 0);

console.log('\n--- 4. Same source: counts from getWorkforceStats, money from estimatePipeline ---');
const dash = readFileSync('app/dashboard/page.tsx', 'utf8');
check('dashboard hero reads stats from getWorkforceStats', /getWorkforceStats/.test(dash) && /stats\?\.(leadsFound|qualifiedLeads|outreachSent|meetingsBooked|pipelineLeads)/.test(dash));
check('dashboard money uses the shared estimatePipeline (not its own math)', /estimatePipeline\(/.test(dash));
const brief = readFileSync('lib/briefing.mjs', 'utf8');
check('briefing money uses the shared estimatePipeline', /estimatePipeline\(/.test(brief));
check('briefing leads with outcomes/pipeline, score demoted to a small line', /Estimated potential pipeline/i.test(brief) && /workforce health/i.test(brief));

console.log('\n--- 5. No hardcoded dollar figures in the outcome surfaces ---');
// A hardcoded ROI/pipeline figure looks like $<digit> in source. The honest paths build
// strings as ('$' + n.toLocaleString()), so the literal '$' is never followed by a digit.
const dashHardMoney = (dash.match(/\$\d/g) || []);
check('no $<number> literal in dashboard', dashHardMoney.length === 0, dashHardMoney.join(' '));
const briefHardMoney = (brief.match(/\$\d/g) || []);
check('no $<number> literal in briefing render', briefHardMoney.length === 0, briefHardMoney.join(' '));

console.log(failures === 0
  ? '\nOUTCOMES VERIFICATION PASSED — pipeline = (qualified+warm)×avgDeal, hidden when unset, $0 honest, shared source, no hardcoded dollars.'
  : `\n${failures} CHECK(S) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
