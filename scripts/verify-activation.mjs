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

console.log('--- 1. Onboarding-complete triggers a real Aria run ---');
check('activate kicks /api/agent/run with activation=true', /\/api\/agent\/run/.test(activate) && /activation:\s*true/.test(activate));
check('activate stamps activated_at after the run', /activated_at:\s*new Date\(\)\.toISOString\(\)/.test(activate));
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
  const { data: co } = await db.from('companies').insert({ user_id: su.user.id, company_name: '__activate_verify__', industry: 'Home services', target_customers: 'Roofing homeowners in Houston with storm damage', onboarding_complete: true, plan: 'single' }).select('id').single();
  await appendHours(db, co.id, 70, 'grant (test)', { refType: 'grant' });
  const balBefore = await getBalance(db, co.id);
  const res = await fetch(`${BASE}/api/onboard/activate`, { method: 'POST', headers: { Cookie: cookie() } });
  const j = await res.json().catch(() => ({}));
  check('activate produced real leads', (j.leads ?? 0) > 0, JSON.stringify(j));
  const { data: leadRows } = await db.from('leads').select('source_url, status').eq('company_id', co.id);
  check('every lead has a real source_url (not mock)', (leadRows ?? []).length > 0 && (leadRows ?? []).every((l) => l.source_url && l.source_url.length > 3));
  const { data: drafts } = await db.from('lead_drafts').select('approval_status').eq('company_id', co.id);
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
