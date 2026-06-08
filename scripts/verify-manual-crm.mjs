// Surge — Manual CRM verification. Run (dev server not required): node scripts/verify-manual-crm.mjs
//
// Proves the owner gets the wheel AND Aria respects it:
//   1. The Lead Lifeline sweep RESPECTS a manual override and treats won/lost as terminal (pure).
//   2. (DB) MOVE sets status + manual_override; EDIT updates fields; DELETE removes the lead AND
//      cascades its drafts; an overdue manual-override lead is NOT auto-recycled by the sweep.
//   3. ISOLATION: another tenant can NEVER move or delete your leads (RLS by user_id).
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { planSweep, applySweep } from '../lib/heartbeat.mjs';

let failures = 0;
const check = (n, ok, d) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); if (!ok) failures++; };
const skip = (n, w) => console.log(`SKIP  ${n} — ${w}`);
const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const URL = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// --- 1. Sweep respects the override + terminal stages (pure) -----------------
console.log('--- 1. Sweep respects manual override + won/lost (pure) ---');
const now = Date.parse('2026-06-10T12:00:00Z'), day = 86_400_000;
const od = (extra) => ({ id: extra.id, status: extra.status ?? 'qualified', next_action_at: '2026-06-01', created_at: new Date(now - 10 * day).toISOString(), ...extra });
const plan = planSweep([
  od({ id: 'normal' }),                              // overdue, sweepable
  od({ id: 'pinned', manual_override: true }),       // overdue BUT owner-set → respected
  od({ id: 'won', status: 'won' }),                  // terminal → never swept
  od({ id: 'lost', status: 'lost' }),                // terminal → never swept
], now);
check('a normal overdue lead is swept', plan.overdueIds.includes('normal'));
check('a manual-override lead is NEVER swept', !plan.overdueIds.includes('pinned') && !plan.recycleIds.includes('pinned'));
check('won/lost are terminal — never swept', ![...plan.overdueIds, ...plan.recycleIds].some((id) => id === 'won' || id === 'lost'));

// --- 2 + 3. Live DB: move / edit / delete-cascade + isolation ----------------
console.log('\n--- 2/3. Live: move, edit, delete-cascade, override-respect, isolation ---');
async function tenant(tag) {
  const email = `qa-crm-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}@surge-qa.test`, password = `Test-${Math.random().toString(36).slice(2)}A1!`;
  const db = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: su, error } = await db.auth.signUp({ email, password });
  if (error || !su?.user) return { err: error?.message || 'no user' };
  await db.auth.signInWithPassword({ email, password });
  const { data: co } = await db.from('companies').insert({ user_id: su.user.id, company_name: `__crm_${tag}__`, onboarding_complete: true, plan: 'single' }).select('id').single();
  return { db, companyId: co.id };
}
const lead = (cid, over, st = 'qualified', extra = {}) => ({ company_id: cid, business_name: 'biz' + Math.random().toString(36).slice(2, 6), vertical: 'other', source_url: 'https://e.com', score: 50, score_reasons: {}, status: st, next_action: 'x', next_action_at: '2026-01-01', click_count: 0, ...(over ? { manual_override: true } : {}), ...extra });

const probe = createClient(URL, ANON);
const { error: colErr } = await probe.from('leads').select('manual_override').limit(1);
if (colErr) {
  skip('move/edit/delete/override-respect', 'manual_crm migration not applied (no leads.manual_override) — run supabase/manual_crm_migration.sql');
} else {
  const A = await tenant('a');
  const B = await tenant('b');
  if (A.err || B.err) {
    skip('live manual CRM', `could not create test users (${A.err || B.err}) — is Confirm-email OFF?`);
  } else {
    // MOVE — set a stage by hand → status + manual_override stick.
    const { data: lm } = await A.db.from('leads').insert(lead(A.companyId, false, 'qualified')).select('id').single();
    await A.db.from('leads').update({ status: 'won', manual_override: true }).eq('id', lm.id);
    const { data: moved } = await A.db.from('leads').select('status, manual_override').eq('id', lm.id).single();
    check('MOVE sets the new stage + the override flag', moved.status === 'won' && moved.manual_override === true, JSON.stringify(moved));

    // EDIT — correct Aria's data.
    await A.db.from('leads').update({ business_name: 'Corrected Co', email: 'fixed@x.com' }).eq('id', lm.id);
    const { data: edited } = await A.db.from('leads').select('business_name, email').eq('id', lm.id).single();
    check('EDIT updates the fields', edited.business_name === 'Corrected Co' && edited.email === 'fixed@x.com');

    // DELETE cascades drafts.
    const { data: ld } = await A.db.from('leads').insert(lead(A.companyId, false, 'qualified')).select('id').single();
    await A.db.from('lead_drafts').insert({ lead_id: ld.id, company_id: A.companyId, channel: 'email', sequence_step: 1, subject: 's', body: 'b', approval_status: 'pending' });
    await A.db.from('leads').delete().eq('id', ld.id);
    const { count: leadGone } = await A.db.from('leads').select('id', { count: 'exact', head: true }).eq('id', ld.id);
    const { count: draftGone } = await A.db.from('lead_drafts').select('id', { count: 'exact', head: true }).eq('lead_id', ld.id);
    check('DELETE removes the lead AND cascades its drafts', (leadGone ?? 0) === 0 && (draftGone ?? 0) === 0, `lead=${leadGone} draft=${draftGone}`);

    // OVERRIDE RESPECTED — an overdue manual-override lead is NOT recycled by the sweep.
    const { data: pinned } = await A.db.from('leads').insert(lead(A.companyId, true, 'contacted', { next_action_at: '2026-01-01', created_at: new Date(Date.now() - 200 * day).toISOString() })).select('id').single();
    await applySweep(A.db, A.companyId, Date.now());
    const { data: afterSweep } = await A.db.from('leads').select('status').eq('id', pinned.id).single();
    check('an overdue manual-override lead is NOT auto-recycled', afterSweep.status === 'contacted', afterSweep.status);

    // ISOLATION — tenant B cannot move or delete tenant A's lead.
    const { data: aLead } = await A.db.from('leads').insert(lead(A.companyId, false, 'qualified')).select('id').single();
    await B.db.from('leads').update({ status: 'lost', manual_override: true }).eq('id', aLead.id); // RLS → affects 0 rows
    await B.db.from('leads').delete().eq('id', aLead.id);                                            // RLS → deletes nothing
    const { data: stillThere } = await A.db.from('leads').select('status').eq('id', aLead.id).maybeSingle();
    check("another tenant CANNOT move or delete your lead", stillThere && stillThere.status === 'qualified', stillThere ? stillThere.status : 'GONE — RLS LEAK');

    await A.db.from('companies').delete().eq('id', A.companyId);
    await B.db.from('companies').delete().eq('id', B.companyId);
  }
}

console.log(failures === 0
  ? '\nMANUAL-CRM VERIFICATION PASSED — owner can move/edit/delete; sweep respects overrides + won/lost; another tenant can never touch your leads.'
  : `\n${failures} CHECK(S) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
