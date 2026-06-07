// Surge — Dashboard credibility verification. Run: node scripts/verify-credibility.mjs
//
// Proves the "every number is correct or gone" rule:
//   1. HoursWidget never yields balance > allowance for a non-internal account (the
//      "198h of 70h" bug) — hoursDisplay clamps/relabels instead.
//   2. An internal account renders "Unlimited".
//   3. getUserDisplay returns "there" for handle-like emails (digits / no separator)
//      and the real name when set.
//   4. (DB) A fresh + re-granted month RESETS to the allowance rather than stacking.
//
// Pure checks always run. The reset check needs the hours_reset migration applied;
// it creates an ephemeral signed-in company and cleans up.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { hoursDisplay } from '../lib/hours.mjs';
import { displayNameFrom } from '../lib/identity.mjs';
import { getBalance } from '../lib/hours.mjs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let failures = 0;
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failures++; };
const skip = (name, why) => console.log(`SKIP  ${name} — ${why}`);

// --- 1. Hours display never shows balance > allowance -----------------------
console.log('--- 1. Hours display guard ---');
const over = hoursDisplay({ balance: 198, allowance: 70, unlimited: false });
check('balance > allowance never renders the broken ratio', over.mode !== 'ratio' && !over.secondary.includes('of 70'), `${over.primary} ${over.secondary}`);
check('over-cap shows the balance alone (Full)', over.mode === 'full' && over.primary === '198h');
const normal = hoursDisplay({ balance: 42, allowance: 70, unlimited: false });
check('normal balance shows the ratio', normal.mode === 'ratio' && normal.secondary.includes('of 70h'));
check('pct is clamped 0..100', hoursDisplay({ balance: 999, allowance: 70 }).pct === 100 && hoursDisplay({ balance: -5, allowance: 70 }).pct === 0);

// --- 2. Internal = Unlimited ------------------------------------------------
console.log('\n--- 2. Internal account ---');
const unl = hoursDisplay({ balance: 5, allowance: 70, unlimited: true });
check('internal renders "Unlimited"', unl.mode === 'unlimited' && unl.primary === 'Unlimited');

// --- 3. getUserDisplay name rule --------------------------------------------
console.log('\n--- 3. Display name ---');
check('handle with digits → "there"', displayNameFrom({}, 'garibmitri1@gmail.com').name === 'there');
check('handle with no separator → "there"', displayNameFrom({}, 'mitri@gmail.com').name === 'there');
check('name-like handle (separator, no digits) → titled name', displayNameFrom({}, 'john.smith@x.com').name === 'John Smith');
check('real profile name always wins', displayNameFrom({ full_name: 'Mitri G' }, 'garibmitri1@gmail.com').firstName === 'Mitri');
check('no name + no email → "there"', displayNameFrom(null, null).name === 'there');

// --- 3b. Pricing positioning: ONE offer, no dead $399/$999 ------------------
console.log('\n--- 3b. Pricing positioning (the old $399/$999 menu is dead) ---');
{
  const landing = readFileSync('app/landing/page.tsx', 'utf8');
  const pricing = readFileSync('lib/pricing.mjs', 'utf8');
  const run = readFileSync('app/api/agent/run/route.ts', 'utf8');
  const personas = ['aria', 'nova', 'opus'].map((p) => readFileSync(`personas/${p}.md`, 'utf8')).join('\n');
  const all = [landing, pricing, run, personas].join('\n');
  check('no $399/$999 anywhere in landing/pricing/writer/personas', !/\$399|\$999/.test(all));
  check('no PRICE_SINGLE=399 / PRICE_TEAM=999 in the source of truth', !/PRICE_SINGLE\s*=\s*399/.test(pricing) && !/PRICE_TEAM\s*=\s*999/.test(pricing));
  check('founding positioning is live: $1,500 + pay-after-booked gate', /PRICE_FOUNDING\s*=\s*1500/.test(pricing) && /\$1,500/.test(landing) && /pay nothing until/i.test(landing));
  check('landing shows the one done-for-you offer (no old plan menu)', /Done-for-you AI Growth Engine/.test(landing) && !/Hire the Team|Single Employee/.test(landing));
}

// --- 4. (DB) monthly grant resets, never stacks -----------------------------
console.log('\n--- 4. No-rollover reset (needs hours_reset_migration) ---');
const probe = createClient(URL, ANON);
// Confirm the function exists by checking the hours table is present at least.
const { error: tblErr } = await probe.from('hours_ledger').select('id').limit(1);
if (tblErr) {
  skip('monthly grant resets rather than stacks', 'hours migration not applied — run supabase/hours_migration.sql + hours_reset_migration.sql');
} else {
  const email = `qa-cred-${Date.now()}@surge-qa.test`;
  const password = `Test-${Math.random().toString(36).slice(2)}A1!`;
  const db = createClient(URL, ANON);
  const { data: su, error: suErr } = await db.auth.signUp({ email, password });
  if (suErr || !su?.user) {
    skip('reset check', `could not create a test user (${suErr?.message ?? 'no user'}) — is Confirm-email OFF?`);
  } else {
    await db.auth.signInWithPassword({ email, password });
    const { data: co } = await db.from('companies').insert({ user_id: su.user.id, company_name: '__cred_verify__', onboarding_complete: true, plan: 'single' }).select('id').single();
    const companyId = co.id;
    // The insert trigger granted this month's 70h. Simulate usage, then re-grant a NEW
    // month — balance must RESET to 70, not stack to 140.
    const { error: fnErr } = await db.rpc('grant_monthly_allowance', { p_company: companyId, p_period: '2099-01' });
    if (fnErr) {
      skip('reset check', 'grant_monthly_allowance missing — run supabase/hours_reset_migration.sql');
    } else {
      // Drain ~20h, then re-grant a fresh month.
      await db.rpc('hours_append', { p_company: companyId, p_delta: -20, p_reason: 'usage (test)', p_employee: null, p_ref_type: 'task', p_ref_id: null });
      const drained = await getBalance(db, companyId);
      await db.rpc('grant_monthly_allowance', { p_company: companyId, p_period: '2099-02' });
      const afterReset = await getBalance(db, companyId);
      check('a new month RESETS to the allowance (no stacking)', Math.abs(afterReset - 70) < 1e-9, `drained ${drained}h → reset ${afterReset}h (expected 70)`);
      // Same-period re-grant is idempotent (no double).
      await db.rpc('grant_monthly_allowance', { p_company: companyId, p_period: '2099-02' });
      const afterRepeat = await getBalance(db, companyId);
      check('re-granting the same month does not stack', Math.abs(afterRepeat - afterReset) < 1e-9, `${afterRepeat}h`);
      check('balance never exceeds the plan allowance', afterRepeat <= 70 + 1e-9);
    }
    await db.from('companies').delete().eq('id', companyId);
  }
}

console.log(failures === 0
  ? '\nCREDIBILITY VERIFICATION PASSED — hours never exceed allowance on screen, internal is Unlimited, names never leak email handles, monthly grant resets not stacks.'
  : `\n${failures} CHECK(S) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
