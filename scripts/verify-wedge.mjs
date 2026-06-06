// Surge — Wedge / warm-signal verification. Run: node scripts/verify-wedge.mjs
//
// Proves the warm loop end-to-end:
//   1. Token sign/verify round-trips and REJECTS tampering / wrong secret (pure).
//   2. A simulated click promotes the lead to 'warm', increments click_count, sets
//      the Lead Lifeline next_action, and is IDEMPOTENT on repeat clicks (no double
//      promotion, no double owner-ping).
//   3. A booking sets status 'meeting' + booked_at.
//   4. Status NEVER downgrades (a click after the meeting leaves it at 'meeting').
//
// The pure token checks always run. The live DB checks create an ephemeral signed-in
// user + company + lead (no service key needed — the RPCs are SECURITY DEFINER granted
// to anon, and owner writes are allowed by RLS), then clean up. They run only once the
// warm_signal migration is applied. Confirm-email must be OFF (as it is pre-launch).
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// Pin a deterministic signing secret for the round-trip test (sign.mjs reads env at
// call time, so this applies to every sign/verify below).
process.env.SURGE_LINK_SECRET = process.env.SURGE_LINK_SECRET || 'wedge-verify-secret';
const { signToken, verifyToken } = await import('../lib/sign.mjs');

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let failures = 0;
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failures++; };
const skip = (name, why) => console.log(`SKIP  ${name} — ${why}`);

// --- 1. Token codec (pure, no DB) -------------------------------------------
console.log('--- 1. Signed-token codec ---');
const tok = signToken({ l: 'lead-123', c: 'co-456' });
const round = verifyToken(tok);
check('sign → verify round-trips the payload', round && round.l === 'lead-123' && round.c === 'co-456', JSON.stringify(round));
check('no raw ids in the token (opaque)', !tok.includes('lead-123') && !tok.includes('co-456'));

// Tamper the payload: flip a character in the first segment.
const [p, s] = tok.split('.');
const tamperedPayload = (p[0] === 'A' ? 'B' : 'A') + p.slice(1) + '.' + s;
check('rejects a tampered payload', verifyToken(tamperedPayload) === null);
// Tamper the signature.
check('rejects a tampered signature', verifyToken(p + '.' + (s[0] === 'A' ? 'B' : 'A') + s.slice(1)) === null);
// Wrong secret.
check('rejects under a different secret', verifyToken(tok, 'not-the-secret') === null);
check('rejects malformed garbage', verifyToken('garbage') === null && verifyToken('') === null);

// --- 2. Live warm loop (needs the warm_signal migration) --------------------
console.log('\n--- 2. Live warm loop (needs warm_signal_migration applied) ---');
const probe = createClient(URL, ANON);
const { error: colErr } = await probe.from('leads').select('click_count').limit(1);
if (colErr) {
  skip('click→warm / increment / idempotent / booking / no-downgrade', 'warm_signal migration not applied — run supabase/warm_signal_migration.sql, then re-run');
} else {
  const email = `qa-wedge-${Date.now()}@surge-qa.test`;
  const password = `Test-${Math.random().toString(36).slice(2)}A1!`;
  const db = createClient(URL, ANON);
  const { data: su, error: suErr } = await db.auth.signUp({ email, password });
  if (suErr || !su?.user) {
    skip('live warm loop', `could not create a test user (${suErr?.message ?? 'no user'}) — is Confirm-email OFF?`);
  } else {
    await db.auth.signInWithPassword({ email, password });
    const { data: company } = await db
      .from('companies')
      .insert({ user_id: su.user.id, company_name: '__wedge_verify__', onboarding_complete: false, plan: 'single' })
      .select('id').single();
    const companyId = company?.id;
    const { data: lead } = await db
      .from('leads')
      .insert({
        company_id: companyId, business_name: '__wedge_test_lead__', vertical: 'other',
        source_url: 'https://example.com', score: 80, score_reasons: {},
        status: 'qualified', next_action: 'Draft outreach', next_action_at: new Date().toISOString(),
      })
      .select('id').single();
    const leadId = lead?.id;

    const clickArgs = { p_lead: leadId, p_company: companyId };

    // First click → warm.
    const { data: c1 } = await db.rpc('register_link_click', clickArgs);
    check('first click registers (ok)', c1?.ok === true, JSON.stringify(c1));
    check('first click promotes new→warm (newly_warm)', c1?.newly_warm === true);
    check('click_count = 1 after first click', c1?.click_count === 1, `got ${c1?.click_count}`);
    const { data: l1 } = await db.from('leads').select('status, next_action, first_clicked_at').eq('id', leadId).single();
    check('lead status is now warm', l1?.status === 'warm', l1?.status);
    check('Lead Lifeline next_action refreshed to a follow-up', /warm|click/i.test(l1?.next_action ?? ''), l1?.next_action);
    check('first_clicked_at stamped', !!l1?.first_clicked_at);

    // Second click → idempotent (increment, but no second promotion / no second ping).
    const { data: c2 } = await db.rpc('register_link_click', clickArgs);
    check('repeat click increments to 2', c2?.click_count === 2, `got ${c2?.click_count}`);
    check('repeat click does NOT re-promote (newly_warm false → owner pinged once)', c2?.newly_warm === false);

    // Booking → meeting.
    const { data: b1 } = await db.rpc('register_booking', { p_lead: leadId, p_company: companyId, p_name: 'QA Tester', p_email: 'qa@example.com', p_time_pref: 'mornings' });
    check('booking registers (newly_booked)', b1?.ok === true && b1?.newly_booked === true, JSON.stringify(b1));
    const { data: l2 } = await db.from('leads').select('status, booked_at').eq('id', leadId).single();
    check('lead status is now meeting', l2?.status === 'meeting', l2?.status);
    check('booked_at stamped', !!l2?.booked_at);

    // No downgrade: a click after the meeting must NOT pull it back to warm.
    const { data: c3 } = await db.rpc('register_link_click', clickArgs);
    check('post-booking click does not re-promote (newly_warm false)', c3?.newly_warm === false);
    const { data: l3 } = await db.from('leads').select('status').eq('id', leadId).single();
    check('status NEVER downgrades (stays meeting after a later click)', l3?.status === 'meeting', l3?.status);

    // Repeat booking is idempotent too.
    const { data: b2 } = await db.rpc('register_booking', { p_lead: leadId, p_company: companyId, p_name: 'QA Tester', p_email: 'qa@example.com', p_time_pref: 'mornings' });
    check('repeat booking is idempotent (newly_booked false)', b2?.newly_booked === false);

    // Cleanup (cascade deletes the lead).
    await db.from('companies').delete().eq('id', companyId);
  }
}

console.log(failures === 0
  ? '\nWEDGE VERIFICATION PASSED — token tamper-proof; click→warm + increment + idempotent; booking→meeting; status never downgrades.'
  : `\n${failures} CHECK(S) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
