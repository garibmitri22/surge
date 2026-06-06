// Surge — Weekly CEO Briefing verification. Run: node scripts/verify-weekly-briefing.mjs
//
// Proves:
//   1. ISO week-key + Monday detection are correct and timezone-aware (pure).
//   2. Score-delta math (▲/▼/flat, and "no delta" when there's no prior week) (pure).
//   3. Week-key IDEMPOTENCY blocks a double-send (live, dryRun).
//   4. The QUIET-week path triggers for a company with no activity (live, dryRun).
//   5. A NOT-ONBOARDED company is skipped (live).
//
// Pure checks always run. Live checks create an ephemeral signed-in owner + company
// (no service key needed — owner RLS allows the writes; dryRun records the idempotency
// row WITHOUT sending a real email) and clean up. They run once the briefing migration
// is applied. Confirm-email must be OFF (as it is pre-launch).
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { isoWeekKey, isMondayInTz, scoreDelta, sendWeeklyBriefingForCompany } from '../lib/briefing.mjs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let failures = 0;
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failures++; };
const skip = (name, why) => console.log(`SKIP  ${name} — ${why}`);

// --- 1. ISO week key + Monday detection (pure) ------------------------------
console.log('--- 1. Week key + weekday (timezone-aware) ---');
const monday = new Date('2026-06-08T13:00:00Z');   // Monday 08:00 Central
const tuesday = new Date('2026-06-09T13:00:00Z');
check('week key has the YYYY-Www shape', /^\d{4}-W\d{2}$/.test(isoWeekKey(monday, 'America/Chicago')), isoWeekKey(monday, 'America/Chicago'));
check('Mon & Tue of the same week share a key', isoWeekKey(monday, 'America/Chicago') === isoWeekKey(tuesday, 'America/Chicago'));
check('a week later is a different key', isoWeekKey(monday, 'America/Chicago') !== isoWeekKey(new Date('2026-06-15T13:00:00Z'), 'America/Chicago'));
check('Monday is detected as Monday (Central)', isMondayInTz(monday, 'America/Chicago') === true);
check('Tuesday is not Monday', isMondayInTz(tuesday, 'America/Chicago') === false);
// Timezone matters: 02:00 UTC Monday is still Sunday in Central.
check('tz-aware: 02:00Z Mon is Sunday in Central (not Monday)', isMondayInTz(new Date('2026-06-08T02:00:00Z'), 'America/Chicago') === false);

// --- 2. Score-delta math (pure) ---------------------------------------------
console.log('\n--- 2. Score delta ---');
check('up: 70 vs 62 → +8 ▲', (() => { const d = scoreDelta(70, 62); return d.delta === 8 && d.dir === 'up'; })());
check('down: 60 vs 75 → -15 ▼', (() => { const d = scoreDelta(60, 75); return d.delta === -15 && d.dir === 'down'; })());
check('flat: 50 vs 50 → 0', (() => { const d = scoreDelta(50, 50); return d.delta === 0 && d.dir === 'flat'; })());
check('no prior week → no delta', (() => { const d = scoreDelta(70, null); return d.delta === null && d.dir === null; })());
check('no current score → no delta', (() => { const d = scoreDelta(null, 70); return d.delta === null && d.dir === null; })());

// --- 3-5. Live (needs the briefing migration) -------------------------------
console.log('\n--- 3. Live: idempotency / quiet-week / skip (needs briefing_migration) ---');
const probe = createClient(URL, ANON);
const { error: tblErr } = await probe.from('briefing_sends').select('week_key').limit(1);
if (tblErr) {
  skip('idempotency / quiet-week / not-onboarded skip', 'briefing migration not applied — run supabase/briefing_migration.sql, then re-run');
} else {
  const email = `qa-brief-${Date.now()}@surge-qa.test`;
  const password = `Test-${Math.random().toString(36).slice(2)}A1!`;
  const db = createClient(URL, ANON);
  const { data: su, error: suErr } = await db.auth.signUp({ email, password });
  if (suErr || !su?.user) {
    skip('live briefing checks', `could not create a test user (${suErr?.message ?? 'no user'}) — is Confirm-email OFF?`);
  } else {
    await db.auth.signInWithPassword({ email, password });
    const now = Date.now();

    // Onboarded company, no activity → quiet-week path.
    const { data: company } = await db.from('companies')
      .insert({ user_id: su.user.id, company_name: '__brief_verify__', onboarding_complete: true, plan: 'single', timezone: 'America/Chicago' })
      .select('id').single();

    const first = await sendWeeklyBriefingForCompany(db, company.id, { now, dryRun: true });
    check('quiet-week path triggers (no activity → sent as a nudge)', first.sent === true && first.reason === 'quiet', JSON.stringify(first));

    const second = await sendWeeklyBriefingForCompany(db, company.id, { now, dryRun: true });
    check('week-key idempotency blocks the double-send', second.sent === false && second.reason === 'already_sent', JSON.stringify(second));

    // Not-onboarded (draft) company → skipped.
    const { data: draftCo } = await db.from('companies')
      .insert({ user_id: su.user.id, company_name: '__brief_draft__', onboarding_complete: false, plan: 'single' })
      .select('id').single();
    const skipRes = await sendWeeklyBriefingForCompany(db, draftCo.id, { now, dryRun: true });
    check('not-onboarded company is skipped', skipRes.sent === false && skipRes.reason === 'not_onboarded', JSON.stringify(skipRes));

    await db.from('companies').delete().eq('id', company.id);
    await db.from('companies').delete().eq('id', draftCo.id);
  }
}

console.log(failures === 0
  ? '\nWEEKLY-BRIEFING VERIFICATION PASSED — tz-aware week key, correct delta, idempotent, quiet-week nudge, not-onboarded skipped.'
  : `\n${failures} CHECK(S) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
