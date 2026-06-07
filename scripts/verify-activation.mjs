// Surge — Day-one activation verification. Run: node scripts/verify-activation.mjs
//
// Proves the guarantees at the code level (always), and end-to-end behind a flag:
//   1. Onboarding-complete triggers a real Aria run (the activate endpoint kicks
//      /api/agent/run with activation=true and stamps activated_at).
//   2. First-run output is REAL, not seeded mock — the run only creates leads via the
//      create_lead tool (which REQUIRES a real source_url); activate seeds no leads.
//   3. No send without approval — drafts are inserted approval_status='pending'.
//   4. The first run isn't charged (comped only while onboarded && !activated_at).
//   Live end-to-end (real Anthropic spend) runs with RUN_ACTIVATION=1.
import { readFileSync } from 'node:fs';

let failures = 0;
const check = (n, ok, d) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); if (!ok) failures++; };

const run = readFileSync('app/api/agent/run/route.ts', 'utf8');
const activate = readFileSync('app/api/onboard/activate/route.ts', 'utf8');
const react = readFileSync('app/api/reactivation/draft/route.ts', 'utf8');
const cron = readFileSync('app/api/cron/topup/route.ts', 'utf8');
const cfg = readFileSync('lib/usage-config.mjs', 'utf8');
const vercel = readFileSync('vercel.json', 'utf8');

console.log('--- 1. Onboarding-complete triggers a real Aria run ---');
check('activate kicks /api/agent/run with activation=true', /\/api\/agent\/run/.test(activate) && /activation:\s*true/.test(activate));
check('the RUN stamps activated_at on success (activate kicks it async)', /activated_at:\s*new Date\(\)\.toISOString\(\)/.test(run) && !/activated_at:\s*new Date\(\)\.toISOString\(\)/.test(activate));
check('activate is idempotent (deterministic claim id + 23505 bail)', /'act_'\s*\+\s*companyId/.test(activate) && /23505/.test(activate));

console.log('\n--- 2. Real data only — no seeded/mock leads ---');
check('activate never inserts leads itself (no mock seeding)', !/from\('leads'\)\.insert/.test(activate));
check('the run only creates leads from real research (source_url required)', /business_name and source_url are required/.test(run));

console.log('\n--- 3. No send without approval ---');
check("activation drafts are created pending approval", /approval_status:\s*'pending'/.test(run));
check('activate does not send anything (no deliverDraft / sendEmail)', !/deliverDraft|sendEmail|sendSms/.test(activate));

console.log('\n--- 4. First run is comped (not charged) ---');
check('run comps activation only while onboarded && !activated_at', /body\.activation === true && company\?\.onboarding_complete === true && !company\?\.activated_at/.test(run));
check('comped run charges 0 hours', /\(thin \|\| comped\) \? 0/.test(run));
check('reactivation draft is also comped during activation', /comped/.test(react) && /\(drafts === 0 \|\| comped\)/.test(react));

console.log('\n--- 4b. Duration env-gated for Pro (MAX_RUN_SECONDS) ---');
check('run route maxDuration = 300 (static literal — Pro ceiling)', /export const maxDuration = 300/.test(run));
check('activate route maxDuration = 300 (static literal)', /export const maxDuration = 300/.test(activate));
check('activation scopes the loop (ACTIVATION_MAX_ITERATIONS set, tight)', /const ACTIVATION_MAX_ITERATIONS = \d+\b/.test(run) && /activationRun \? ACTIVATION_MAX_ITERATIONS/.test(run));
check('activation targets ~10–12 leads; manual capped at ~12–15 (not 30–50)', /activationRun \? '10–12'/.test(run) && / : '12–15'/.test(run) && /const MAX_ITERATIONS = \d+\b/.test(run));
check('runs are time-bounded: tight loop ceiling + deterministic lead-cap early-break', /const leadCap =/.test(run) && /counters\.leads >= leadCap/.test(run));
check('run failures/timeouts report to Sentry', /Sentry\.captureException/.test(run));

console.log('\n--- 4c. Async run: ack fast, work in after(), parallel drafts ---');
check('run ACKS immediately (accepted) and processes in after()', /after\(async/.test(run) && /accepted: true/.test(run));
check('activate ACKS immediately (activating) and kicks the run in after()', /after\(async/.test(activate) && /activating: true/.test(activate));
check('draft writes run concurrently, bounded (DRAFT_CONCURRENCY)', /mapBounded/.test(run) && /DRAFT_CONCURRENCY/.test(run));

console.log('\n--- 4d. Transactional activation: stamp ONLY on success, no stuck claim ---');
check('the RUN releases its activation claim on failure (no stuck claim → retries)',
  /if \(activationRun\)/.test(run) && /from\('tasks'\)\.delete\(\)\.eq\('id', taskId\)/.test(run));
check('activated_at is stamped success-only + guarded (run stamps, never on the catch path)',
  /activated_at: new Date\(\)\.toISOString\(\)/.test(run) && /is\('activated_at', null\)/.test(run));
check('stale-claim reclaim retries a killed run (60s-wall case where cleanup never ran)',
  /STALE_CLAIM_MS/.test(activate) && /claimAgeMs < STALE_CLAIM_MS/.test(activate) && /from\('tasks'\)\.delete\(\)/.test(activate));

console.log('\n--- 4e. Daily pipeline top-up (charged drip to a replenishing ceiling) ---');
check('DAILY_TOPUP_TARGET is centralized (single source, not hardcoded everywhere)',
  /export const DAILY_TOPUP_TARGET = 10/.test(cfg) && /DAILY_TOPUP_TARGET/.test(run) && /DAILY_TOPUP_TARGET/.test(cron) && !/const DAILY_TOPUP_TARGET = /.test(run) && !/const DAILY_TOPUP_TARGET = /.test(cron));
check('OPEN_LEAD_CEILING = 40 (replenishing cap on UN-WORKED leads)',
  /export const OPEN_LEAD_CEILING = 40/.test(cfg) && /not\('status', 'in'/.test(cron));
check('top-up respects the target (capped + tapered by the cron)',
  /Math\.min\(DAILY_TOPUP_TARGET, Math\.round\(body\.target/.test(run) && /target = Math\.min\(target, 5\)/.test(cron));
check('top-up dedupes before create_lead (existing names injected + DB unique backstop)',
  /ALREADY IN THE PIPELINE/.test(run) && /counters\.dups\+\+/.test(run));
check('exhaustion → expansion upsell surfaced (not silent churn)',
  /topup-exhaust-/.test(run) && /widen the radius/.test(run));
check('top-up DEBITS hours (charged, not comped) except is_internal',
  /getBalance/.test(cron) && /c\.is_internal/.test(cron) && /topup: true/.test(cron) && !/topup.*comped|comped.*topup/i.test(run));
check('top-up is scheduled (its own cron pass, offset from the heartbeat)',
  /\/api\/cron\/topup/.test(vercel) && /export const maxDuration = 300/.test(cron));

console.log('\n--- 5. Live end-to-end (RUN_ACTIVATION=1; real Anthropic spend) ---');
if (process.env.RUN_ACTIVATION !== '1') {
  console.log('SKIP  live activation run — set RUN_ACTIVATION=1 (creates an onboarded test company, real run) to exercise it');
} else {
  const BASE = process.argv[2] || 'http://localhost:3001';
  const { createClient } = await import('@supabase/supabase-js');
  const { createServerClient } = await import('@supabase/ssr');
  const { getBalance, appendHours } = await import('../lib/hours.mjs');
  const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
  const URL = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = `qa-activate-${Date.now()}@surge-qa.test`, password = `Test-${Math.random().toString(36).slice(2)}A1!`;
  const store = new Map();
  const ssr = createServerClient(URL, ANON, { cookies: { getAll: () => [...store.entries()].map(([name, value]) => ({ name, value })), setAll: (cs) => cs.forEach(({ name, value }) => store.set(name, value)) } });
  const db = createClient(URL, ANON);
  const { data: su } = await ssr.auth.signUp({ email, password });
  await db.auth.signInWithPassword({ email, password });
  const cookie = () => [...store.entries()].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join('; ');
  const { data: co } = await db.from('companies').insert({ user_id: su.user.id, company_name: '__activate_verify__', industry: 'Aesthetics marketing agency', target_customers: 'Med spas and aesthetic clinics in Austin, Texas', brand_tone: 'professional', onboarding_complete: true, plan: 'single' }).select('id').single();
  await appendHours(db, co.id, 70, 'grant (test)', { refType: 'grant' });
  const balBefore = await getBalance(db, co.id);
  // ASYNC: activate ACKS immediately and runs Aria in the background. Poll until the run
  // stamps activated_at (or we time out), and report the wall-time + the lead/draft counts.
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/onboard/activate`, { method: 'POST', headers: { Cookie: cookie() } });
  const j = await res.json().catch(() => ({}));
  check('activate ACKS immediately (async kick, no hanging request)', j.activating === true, JSON.stringify(j));
  let activated = false;
  const deadline = Date.now() + 6 * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));
    const { data: comp } = await db.from('companies').select('activated_at').eq('id', co.id).maybeSingle();
    if (comp?.activated_at) { activated = true; break; }
  }
  const wallSec = ((Date.now() - t0) / 1000).toFixed(1);
  check('background run completed + stamped activated_at on success', activated, `wall-time ${wallSec}s (must be < 300s on Pro)`);
  check(`real-run wall-time is under the 300s Pro ceiling`, Number(wallSec) < 300, `${wallSec}s`);
  const { data: leadRows } = await db.from('leads').select('source_url, status').eq('company_id', co.id);
  const { data: drafts } = await db.from('lead_drafts').select('approval_status').eq('company_id', co.id);
  check('activate produced real leads', (leadRows ?? []).length > 0, `${(leadRows ?? []).length} leads, ${(drafts ?? []).length} drafts in ${wallSec}s`);
  check('every lead has a real source_url (not mock)', (leadRows ?? []).length > 0 && (leadRows ?? []).every((l) => l.source_url && l.source_url.length > 3));
  check('drafts are pending — nothing sent without approval', (drafts ?? []).length > 0 && (drafts ?? []).every((d) => d.approval_status === 'pending'));
  const balAfter = await getBalance(db, co.id);
  check('first run was NOT charged (comped)', Math.abs(balAfter - balBefore) < 1e-9, `Δ ${(balBefore - balAfter).toFixed(2)}h`);
  const res2 = await fetch(`${BASE}/api/onboard/activate`, { method: 'POST', headers: { Cookie: cookie() } });
  const j2 = await res2.json().catch(() => ({}));
  check('activation is idempotent (second call already:true)', j2.already === true, JSON.stringify(j2));
  await db.from('companies').delete().eq('id', co.id);
}

console.log(failures === 0
  ? '\nACTIVATION VERIFICATION PASSED — onboarding kicks a real comped Aria run, real data only, drafts pending approval, first run free.'
  : `\n${failures} CHECK(S) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
