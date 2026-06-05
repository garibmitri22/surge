// Surge — Hours metering verification. Run (dev server up): node scripts/verify-hours.mjs [baseURL]
// Config + grep-proofs run always. Live DB checks run only when the hours migration
// is applied (otherwise they SKIP with a clear note — run supabase/hours_migration.sql).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { HOUR_PRICES, ALLOWANCES, estimateHours, formatHours, overtimeMessage, allowanceForPlan } from '../lib/pricing.mjs';

const BASE = process.argv[2] || 'http://localhost:3000';
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let failures = 0;
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failures++; };
const skip = (name, why) => console.log(`SKIP  ${name} — ${why}`);

// ---- recursive file collector for grep-proofs --------------------------------
function walk(dir, exts, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) { if (e !== 'node_modules' && e !== '.next') walk(p, exts, acc); }
    else if (exts.some((x) => p.endsWith(x))) acc.push(p);
  }
  return acc;
}

console.log('--- 1. Hours config (lib/pricing.mjs) ---');
check('HOUR_PRICES has research_scan + aria_run', HOUR_PRICES.research_scan === 0.5 && HOUR_PRICES.aria_run === 2, JSON.stringify(HOUR_PRICES));
check('ALLOWANCES single 70 / team 200', ALLOWANCES.single === 70 && ALLOWANCES.team === 200, JSON.stringify(ALLOWANCES));
check('estimateHours reads the price table; unknown action = 0', estimateHours('aria_run') === 2 && estimateHours('nope') === 0);
check('formatHours renders hours (e.g. 0.5h / 2h)', formatHours(0.5) === '0.5h' && formatHours(2) === '2h');
const ot = overtimeMessage('Aria', 1);
check('overtime message is in character (hours/overtime, no error text)', /aria/i.test(ot) && /overtime/i.test(ot) && /hour/i.test(ot) && !/error|429|402|null|undefined/i.test(ot), ot);

console.log('\n--- 2. Grep-proofs ---');
const codeFiles = [...walk('app', ['.ts', '.tsx']), ...walk('lib', ['.ts', '.tsx', '.mjs'])];
const quotaHits = codeFiles.filter((f) => /PLAN_QUOTAS|quotaForPlan|consume_task_run|capacityMessage|taskRunsPerMonth/.test(readFileSync(f, 'utf8')));
check('no quota-config references left in app/ + lib/', quotaHits.length === 0, quotaHits.join(', ') || 'clean');
// Customer-facing copy must never say credit/coin/token (internal table/code names are fine).
const uiFiles = [...walk('app', ['.tsx']), ...walk('components', ['.tsx'])];
const coinHits = [];
for (const f of uiFiles) {
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    if (/\b(credit|credits|coin|coins|token|tokens)\b/i.test(line) && !/credential/i.test(line)) coinHits.push(`${f}: ${line.trim().slice(0, 80)}`);
  }
}
check('no customer-facing credit/coin/token strings', coinHits.length === 0, coinHits.join(' | ') || 'clean');

console.log('\n--- 3. Live DB checks (need the hours migration + dev server) ---');
const probe = createClient(URL, ANON);
const { error: migErr } = await probe.rpc('hours_balance', { p_company: '00000000-0000-0000-0000-000000000000' });
if (migErr) {
  skip('balance gates a run / thin=0 / debit matches price / RLS isolation', 'hours migration not applied — run supabase/hours_migration.sql, then re-run');
} else {
  // --- auth + cookie bridge (browser-equivalent, like e2e-onboarding) ---
  const email = `qa-hours-${Date.now()}@surge-qa.test`;
  const password = `Test-${Math.random().toString(36).slice(2)}A1!`;
  const store = new Map();
  const ssr = createServerClient(URL, ANON, {
    cookies: { getAll: () => [...store.entries()].map(([name, value]) => ({ name, value })), setAll: (cs) => cs.forEach(({ name, value }) => store.set(name, value)) },
  });
  const db = createClient(URL, ANON);
  const { data: su } = await ssr.auth.signUp({ email, password });
  await db.auth.signInWithPassword({ email, password });
  const cookieHeader = () => [...store.entries()].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join('; ');

  // The grant-on-creation trigger needs a company row; create the draft via research route auth?
  // Simpler: research route get-or-creates the draft. But first ensure a company exists by inserting one.
  const { data: company } = await db.from('companies').insert({ user_id: su.user.id, onboarding_complete: false, plan: 'single' }).select('id').single();
  const companyId = company?.id;

  // 3a. Trigger grant matches the config allowance.
  const { data: bal0 } = await db.rpc('hours_balance', { p_company: companyId });
  check('new company granted the config allowance on creation', Number(bal0) === allowanceForPlan('single'), `balance ${bal0}, expected ${allowanceForPlan('single')}`);

  // 3b. RLS isolation: a different user cannot read this ledger.
  const other = createClient(URL, ANON);
  await other.auth.signUp({ email: `qa-hours-other-${Date.now()}@surge-qa.test`, password });
  const { data: stolen } = await other.rpc('hours_balance', { p_company: companyId });
  check('RLS isolates ledgers (other user sees 0 for my company)', Number(stolen ?? 0) === 0, `other saw ${stolen}`);

  // 3c. Gate: drain below the research cost, then a research call must refuse (402).
  await db.rpc('hours_append', { p_company: companyId, p_delta: -(Number(bal0) - 0.2), p_reason: 'drain (test)', p_employee: null, p_ref_type: 'grant', p_ref_id: null });
  const lowRes = await fetch(`${BASE}/api/onboard/research`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookieHeader() },
    body: JSON.stringify({ url: 'https://www.anthropic.com' }),
  });
  const lowJson = await lowRes.json().catch(() => ({}));
  check('balance gates work: research refused when under cost (402 out_of_hours)', lowRes.status === 402 && lowJson.out_of_hours === true, `status ${lowRes.status}`);

  // 3d. Grant hours, run a meaningful scan, assert it debits exactly research_scan.
  await db.rpc('hours_append', { p_company: companyId, p_delta: 10, p_reason: 'top-up (test)', p_employee: null, p_ref_type: 'grant', p_ref_id: null });
  const { data: balBefore } = await db.rpc('hours_balance', { p_company: companyId });
  const scanRes = await fetch(`${BASE}/api/onboard/research`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookieHeader() },
    body: JSON.stringify({ url: 'https://www.anthropic.com' }),
  });
  const scanJson = await scanRes.json().catch(() => ({}));
  const { data: balAfter } = await db.rpc('hours_balance', { p_company: companyId });
  const debited = Number(balBefore) - Number(balAfter);
  if (scanJson.meaningful) {
    check('meaningful scan debits exactly research_scan hours', Math.abs(debited - HOUR_PRICES.research_scan) < 0.001, `debited ${debited}h`);
  } else {
    check('thin scan debits ZERO (customer never pays for our misses)', Math.abs(debited) < 0.001, `debited ${debited}h`);
  }

  // cleanup (company cascade removes its ledger). Auth users remain (anon can't delete).
  await db.from('companies').delete().eq('id', companyId);
}

console.log(failures === 0 ? '\nHOURS VERIFICATION PASSED (config + grep-proofs; live checks where the migration is applied).' : `\n${failures} CHECK(S) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
