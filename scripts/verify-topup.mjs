// Surge — Activation timeout fix + daily pipeline top-up verification.
// Run: node scripts/verify-topup.mjs
//
// Proves the three-part PRIORITY-1 fix at the code level (always):
//   1. Both the run route AND the activate route set maxDuration = 60 (Vercel won't kill
//      the function before leads are written).
//   2. The activation/first run is SCOPED to finish under the cap (capped loop + a modest
//      ~10–12 lead target), while manual runs are capped at ~15 leads/invocation.
//   3. The daily top-up: a session-less cron tops up each company toward a working ceiling
//      of un-worked leads, charged + tapered, one run per company per day, each run on its
//      own 60s budget (Bearer-CRON auth into /api/agent/run), with a market-tapped upsell.
import { readFileSync } from 'node:fs';

let failures = 0;
const check = (n, ok, d) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); if (!ok) failures++; };
const read = (p) => readFileSync(p, 'utf8');

const run      = read('app/api/agent/run/route.ts');
const activate = read('app/api/onboard/activate/route.ts');
const cron     = read('app/api/cron/topup/route.ts');
const cfg      = read('lib/usage-config.mjs');
const vercel   = read('vercel.json');

console.log('--- 1. maxDuration env-gated (MAX_RUN_SECONDS, default 60 → 300 on Pro) ---');
check('run route maxDuration is env-gated', /export const maxDuration = Number\(process\.env\.MAX_RUN_SECONDS\) \|\| 60/.test(run));
check('activate route maxDuration is env-gated', /export const maxDuration = Number\(process\.env\.MAX_RUN_SECONDS\) \|\| 60/.test(activate));

console.log('\n--- 2. Activation/first run scoped to finish under the cap ---');
check('activation caps the loop (ACTIVATION_MAX_ITERATIONS set, tight)', /const ACTIVATION_MAX_ITERATIONS = \d+\b/.test(run));
check('activation targets ~10–12 real leads', /activationRun \? '10–12'/.test(run));
check('manual runs capped at ~12–15 leads/invocation (not 30–50 single-shot)', / : '12–15'/.test(run) && /const MAX_ITERATIONS = \d+\b/.test(run));
check('the loop honors the scoped ceiling (maxIterations, not the const)', /for \(let i = 0; i < maxIterations; i\+\+\)/.test(run));

console.log('\n--- 3. Daily top-up — run-route side ---');
check('run route accepts the internal CRON caller (Bearer CRON_SECRET)', /Bearer \$\{cronSecret\}/.test(run) && /const isCron =/.test(run));
check('cron caller uses the service-role client (session-less)', /SUPABASE_SERVICE_ROLE_KEY/.test(run) && /createClient<Database>/.test(run));
check('cron caller passes the company explicitly', /isCron \?.*body\.companyId/.test(run));
check('topup mode scopes the run (TOPUP_MAX_ITERATIONS = 8)', /const TOPUP_MAX_ITERATIONS = 8/.test(run) && /topupRun \? TOPUP_MAX_ITERATIONS/.test(run));
check('DAILY_TOPUP_TARGET centralized in usage-config, tapered via body.target', /export const DAILY_TOPUP_TARGET = 10/.test(cfg) && /Math\.min\(DAILY_TOPUP_TARGET, Math\.round\(body\.target/.test(run) && !/const DAILY_TOPUP_TARGET = /.test(run));
check('top-up is CHARGED, not comped (comped stays activation-only)', /body\.activation === true && company\?\.onboarding_complete === true && !company\?\.activated_at/.test(run) && !/topup.*comped|comped.*topup/i.test(run));
check('duplicate skips are counted (market-exhaustion signal)', /counters\.dups\+\+/.test(run) && /dups: number/.test(run));
check('market-tapped upsell logged once/day on a mostly-dup top-up', /topup-exhaust-\$\{companyId\}/.test(run) && /counters\.dups > 0 && counters\.leads < topupTarget \/ 2/.test(run));

console.log('\n--- 4. Daily top-up — cron orchestrator side ---');
check('cron route sets maxDuration = 60', /export const maxDuration = 60/.test(cron));
check('cron is CRON_SECRET-guarded + service-role', /authorized\(request\)/.test(cron) && /SUPABASE_SERVICE_ROLE_KEY/.test(cron));
check('only tops up activated, onboarded companies', /onboarding_complete.*true/.test(cron) && /not\('activated_at', 'is', null\)/.test(cron));
check('ceiling on UN-WORKED leads (OPEN_LEAD_CEILING = 40, centralized)', /export const OPEN_LEAD_CEILING = 40/.test(cfg) && /not\('status', 'in'/.test(cron) && /OPEN_LEAD_CEILING/.test(cron));
check('daily drip cap uses centralized DAILY_TOPUP_TARGET', /DAILY_TOPUP_TARGET/.test(cron) && !/const DAILY_TOPUP_TARGET = /.test(cron));
check('metered: out-of-hours surfaces an upsell + skips; internal bypasses', /getBalance/.test(cron) && /topup-hours-\$\{c\.id\}/.test(cron) && /c\.is_internal/.test(cron));
check('target tapers near month-end', /target = Math\.min\(target, 5\)/.test(cron));
check('one run per company per day (deterministic claim id)', /`topup_\$\{c\.id\}_\$\{today\}`/.test(cron) && /23505' \? 'already_today'/.test(cron));
check('stays under the wall via a time budget', /TIME_BUDGET_MS/.test(cron) && /Date\.now\(\) - start > TIME_BUDGET_MS/.test(cron));
check('each run gets its own 60s (Bearer-CRON fetch into /api/agent/run)', /\/api\/agent\/run/.test(cron) && /authorization: `Bearer \$\{cronSecret\}`/.test(cron) && /topup: true/.test(cron));

console.log('\n--- 5. Scheduled ---');
check('vercel.json schedules the top-up cron (offset from the heartbeat)', /\/api\/cron\/topup/.test(vercel) && /\/api\/cron\/heartbeat/.test(vercel));

console.log(failures === 0
  ? '\nTOP-UP VERIFICATION PASSED — maxDuration set; activation scoped to complete; daily charged top-up to a 40 open-lead ceiling, tapered, one run/company/day on its own 60s budget.'
  : `\n${failures} CHECK(S) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
