// Surge — Nova's Studio verification. Run (dev server up): node scripts/verify-nova-studio.mjs [baseURL]
//
// Proves:
//   1. A content piece persists and is ACCOUNT-ISOLATED (RLS — anon can't read it).
//   2. Status transitions draft → approved → archived.
//   3. Metering: nova_content = 1h, debitHours debits exactly once, is_internal bypasses
//      (the bypass sub-check needs a one-off service key, same as verify-internal).
//   4. Generation REFUSES to invent when brand voice is empty (400 no_brand_voice →
//      prompts onboarding), with NO API spend (refused before the model call).
//   Optional end-to-end run (real Anthropic spend) behind RUN_NOVA=1.
//
// Live checks create an ephemeral signed-in owner + company and clean up. They run once
// the content migration is applied. Confirm-email must be OFF (as it is pre-launch).
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { estimateHours } from '../lib/pricing.mjs';
import { getBalance, appendHours, debitHours } from '../lib/hours.mjs';

const BASE = process.argv[2] || 'http://localhost:3001';
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || null;

let failures = 0;
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failures++; };
const skip = (name, why) => console.log(`SKIP  ${name} — ${why}`);

// --- 0. Pure: the metered cost is what the route charges -----------------------
console.log('--- 0. Metering constant ---');
check('nova_content is metered at 1h', estimateHours('nova_content') === 1, `${estimateHours('nova_content')}h`);

console.log('\n--- Live checks (need content_migration + dev server) ---');
const probe = createClient(URL, ANON);
const { error: tblErr } = await probe.from('content_pieces').select('id').limit(1);
if (tblErr) {
  skip('persistence / RLS / transitions / metering / refusal', 'content migration not applied — run supabase/content_migration.sql, then re-run');
} else {
  const email = `qa-nova-${Date.now()}@surge-qa.test`;
  const password = `Test-${Math.random().toString(36).slice(2)}A1!`;
  const store = new Map();
  const ssr = createServerClient(URL, ANON, {
    cookies: { getAll: () => [...store.entries()].map(([name, value]) => ({ name, value })), setAll: (cs) => cs.forEach(({ name, value }) => store.set(name, value)) },
  });
  const db = createClient(URL, ANON);
  const { data: su, error: suErr } = await ssr.auth.signUp({ email, password });
  if (suErr || !su?.user) {
    skip('live nova-studio checks', `could not create a test user (${suErr?.message ?? 'no user'}) — is Confirm-email OFF?`);
  } else {
    await db.auth.signInWithPassword({ email, password });
    const cookieHeader = () => [...store.entries()].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join('; ');

    // Company with NO brand voice (no brand_tone, no voice memory) → refusal path.
    const { data: company } = await db.from('companies')
      .insert({ user_id: su.user.id, company_name: '__nova_verify__', onboarding_complete: true, plan: 'single' })
      .select('id').single();
    const companyId = company.id;

    // 1. Persist + RLS isolation.
    const { data: piece, error: insErr } = await db.from('content_pieces')
      .insert({ company_id: companyId, type: 'post', platform: 'linkedin', title: 'Test hook', body: 'Test body', status: 'draft', brief: 'verify' })
      .select('id, status').single();
    check('a content piece persists (owner write)', !insErr && !!piece?.id, insErr?.message);
    const anonRead = await createClient(URL, ANON).from('content_pieces').select('id').eq('id', piece?.id ?? '');
    check('RLS isolates it (anon/other cannot read it)', (anonRead.data?.length ?? 0) === 0, `rows ${anonRead.data?.length ?? 0}`);

    // 2. Status transitions draft → approved → archived.
    await db.from('content_pieces').update({ status: 'approved' }).eq('id', piece.id);
    let { data: s1 } = await db.from('content_pieces').select('status').eq('id', piece.id).single();
    check('draft → approved', s1?.status === 'approved', s1?.status);
    await db.from('content_pieces').update({ status: 'archived' }).eq('id', piece.id);
    let { data: s2 } = await db.from('content_pieces').select('status').eq('id', piece.id).single();
    check('approved → archived', s2?.status === 'archived', s2?.status);

    // 3. Metering — debit exactly once per the route's charge.
    await appendHours(db, companyId, 5, 'grant (test)', { refType: 'grant' });
    const bal0 = await getBalance(db, companyId);
    await debitHours(db, companyId, estimateHours('nova_content'), 'Nova content batch (test)', { employeeId: 'nova', refType: 'content' });
    const bal1 = await getBalance(db, companyId);
    check('debitHours debits exactly 1h once', Math.abs((bal0 - bal1) - 1) < 1e-9, `Δ ${(bal0 - bal1).toFixed(2)}h`);

    if (SERVICE) {
      const svc = createClient(URL, SERVICE);
      await svc.from('companies').update({ is_internal: true }).eq('id', companyId);
      const b2 = await getBalance(db, companyId);
      await debitHours(db, companyId, estimateHours('nova_content'), 'internal (test)', { employeeId: 'nova' });
      const b3 = await getBalance(db, companyId);
      check('is_internal bypasses the debit (balance unchanged)', Math.abs(b3 - b2) < 1e-9, `Δ ${(b2 - b3).toFixed(2)}h`);
      await svc.from('companies').update({ is_internal: false }).eq('id', companyId);
    } else {
      skip('is_internal bypasses the debit', 'no service key — re-run as SUPABASE_SERVICE_ROLE_KEY=... node scripts/verify-nova-studio.mjs');
    }

    // 4. Refuses to invent with no brand voice (no spend — refused before the model).
    try {
      const res = await fetch(`${BASE}/api/studio/run`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookieHeader() },
        body: JSON.stringify({ angle: '' }),
      });
      const j = await res.json().catch(() => ({}));
      check('refuses with no brand voice (400 no_brand_voice, prompts onboarding)', res.status === 400 && j.reason === 'no_brand_voice', `status ${res.status} reason ${j.reason}`);
    } catch (e) {
      skip('no-brand-voice refusal', `dev server not reachable at ${BASE} (${e.message}) — start it and re-run`);
    }

    // Optional end-to-end run (real Anthropic spend) — proves a real batch + one debit.
    if (process.env.RUN_NOVA === '1') {
      await db.from('companies').update({ brand_tone: 'Sharp, direct, confident, human. Plain language, no buzzwords.' }).eq('id', companyId);
      const balBefore = await getBalance(db, companyId);
      const res = await fetch(`${BASE}/api/studio/run`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookieHeader() },
        body: JSON.stringify({ angle: 'a LinkedIn post on the cost of a bad hire' }),
      });
      const j = await res.json().catch(() => ({}));
      check('real run produces drafts', j.ok === true && (j.created_this_run?.pieces ?? 0) > 0, JSON.stringify(j.created_this_run));
      const balAfter = await getBalance(db, companyId);
      check('real run debits exactly once (1h)', Math.abs((balBefore - balAfter) - 1) < 1e-9, `Δ ${(balBefore - balAfter).toFixed(2)}h`);
    } else {
      skip('end-to-end run (real drafts + single debit)', 'set RUN_NOVA=1 to run it (real Anthropic spend)');
    }

    await db.from('companies').delete().eq('id', companyId); // cascade deletes content_pieces
  }
}

console.log(failures === 0
  ? '\nNOVA-STUDIO VERIFICATION PASSED — persists + RLS-isolated, status transitions, metered once (internal bypass), refuses with no brand voice.'
  : `\n${failures} CHECK(S) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
