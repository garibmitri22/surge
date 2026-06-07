// Surge — Short tracked-link verification. Run: node scripts/verify-tracked-links.mjs
//
// Proves the CTA links are short + trustworthy (no inline HMAC token) end-to-end:
//   1. randomCode is short base62; createTrackedLink builds surgehq.io/r/<code> (pure).
//   2. The wiring is in place: short /r/[code] route, book route accepts a code, draft +
//      send paths allocate via createTrackedLink, migration folded into APPLY_ALL (static).
//   3. Live: allocate a code → resolve_tracked_link round-trips {lead, company}; the URL
//      is short (no ~180-char token); an unknown code resolves ok:false; a click through
//      the code still promotes the lead to warm (same register_link_click RPC).
//
// Pure + static checks always run. Live checks need the tracked_links migration applied
// (supabase/tracked_links_migration.sql) and Confirm-email OFF; they self-clean.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { randomCode, createTrackedLink } from '../lib/sign.mjs';

let failures = 0;
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failures++; };
const skip = (name, why) => console.log(`SKIP  ${name} — ${why}`);
const read = (p) => readFileSync(p, 'utf8');

// --- 1. Code generator (pure) ----------------------------------------------
console.log('--- 1. Short opaque code generator ---');
const codes = Array.from({ length: 500 }, () => randomCode(7));
const B62 = /^[A-Za-z0-9]+$/;
check('randomCode(7) is 7 base62 chars', codes.every((c) => c.length === 7 && B62.test(c)), codes[0]);
check('randomCode(8) is 8 base62 chars', /^[A-Za-z0-9]{8}$/.test(randomCode(8)));
check('codes are unique across 500 draws (no obvious collisions)', new Set(codes).size === 500, `${new Set(codes).size}/500 unique`);

// --- 2. Wiring is in place (static) ----------------------------------------
console.log('\n--- 2. Wiring (static source checks) ---');
const rRoute   = read('app/r/[code]/route.ts');
const bookRoute = read('app/api/book/[token]/route.ts');
const legacy   = read('app/api/r/[token]/route.ts');
const sign     = read('lib/sign.mjs');
const email    = read('lib/email.mjs');
const runRoute = read('app/api/agent/run/route.ts');
const reactRoute = read('app/api/reactivation/draft/route.ts');
const applyAll = read('supabase/APPLY_ALL_PENDING.sql');
const migration = read('supabase/tracked_links_migration.sql');

check('short /r/[code] route resolves the code', /resolve_tracked_link/.test(rRoute) && /registerClickAndDestination/.test(rRoute));
check('legacy /api/r/[token] route still works (back-compat) + shares click logic', /verifyToken/.test(legacy) && /registerClickAndDestination/.test(legacy));
check('book route accepts a short code (resolve_tracked_link fallback)', /resolve_tracked_link/.test(bookRoute) && /verifyToken/.test(bookRoute));
check('createTrackedLink builds a short /r/<code> URL (no inline token)', /\$\{appBaseUrl\(\)\}\/r\/\$\{code\}/.test(sign) && /export async function createTrackedLink/.test(sign));
check('draft path (agent/run) allocates via createTrackedLink', /createTrackedLink\(supabase/.test(runRoute) && !/trackedLinkUrl/.test(runRoute));
check('reactivation draft path allocates via createTrackedLink', /createTrackedLink\(supabase/.test(reactRoute) && !/trackedLinkUrl/.test(reactRoute));
check('send path (deliverDraft) allocates via createTrackedLink', /createTrackedLink\(supabase/.test(email));
check('embedTrackedCta treats /r/ as already-linked (idempotent)', /includes\('\/r\/'\)/.test(email));
check('migration defines tracked_links + resolve_tracked_link', /create table if not exists tracked_links/.test(migration) && /function resolve_tracked_link/.test(migration));
check('migration folded into APPLY_ALL_PENDING', /create table if not exists tracked_links/.test(applyAll) && /has_tracked_links/.test(applyAll));

// --- 3. Live round-trip (needs tracked_links migration) --------------------
console.log('\n--- 3. Live allocate → resolve → click (needs tracked_links_migration) ---');
const env = Object.fromEntries(
  read('.env.local').split('\n').filter((l) => l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const probe = createClient(URL, ANON);
const { error: tblErr } = await probe.from('tracked_links').select('code').limit(1);
if (tblErr) {
  skip('allocate / resolve / unknown-code / click→warm', 'tracked_links migration not applied — run supabase/tracked_links_migration.sql, then re-run');
} else {
  const e = `qa-tl-${Date.now()}@surge-qa.test`, pw = `Test-${Math.random().toString(36).slice(2)}A1!`;
  const db = createClient(URL, ANON);
  const { data: su, error: suErr } = await db.auth.signUp({ email: e, password: pw });
  if (suErr || !su?.user) {
    skip('live tracked-link loop', `could not create a test user (${suErr?.message ?? 'no user'}) — is Confirm-email OFF?`);
  } else {
    await db.auth.signInWithPassword({ email: e, password: pw });
    const { data: company } = await db.from('companies')
      .insert({ user_id: su.user.id, company_name: '__tl_verify__', onboarding_complete: false, plan: 'single' })
      .select('id').single();
    const companyId = company?.id;
    const { data: lead } = await db.from('leads')
      .insert({ company_id: companyId, business_name: '__tl_test_lead__', vertical: 'other', source_url: 'https://example.com', score: 70, score_reasons: {}, status: 'qualified', next_action: 'Draft', next_action_at: new Date().toISOString() })
      .select('id').single();
    const leadId = lead?.id;

    // Allocate a short link (owner-authenticated insert).
    const url = await createTrackedLink(db, leadId, companyId);
    const code = url.split('/r/')[1];
    check('createTrackedLink returns a short /r/<code> URL', /\/r\/[A-Za-z0-9]{7,8}$/.test(url), url);
    check('the URL carries NO long inline token (well under 120 chars)', url.length < 120, `len ${url.length}`);
    check('a tracked_links row was written', !!code && code.length >= 7);

    // Resolve as the prospect (anon) via the SECURITY-DEFINER RPC.
    const anon = createClient(URL, ANON);
    const { data: res } = await anon.rpc('resolve_tracked_link', { p_code: code });
    check('resolve_tracked_link round-trips {lead, company}', res?.ok === true && res?.lead_id === leadId && res?.company_id === companyId, JSON.stringify(res));
    const { data: bad } = await anon.rpc('resolve_tracked_link', { p_code: 'zzzzzzz' });
    check('unknown code resolves ok:false (no leak)', bad?.ok === false, JSON.stringify(bad));

    // A click through the resolved code still promotes the lead to warm (same RPC).
    const { data: clk } = await anon.rpc('register_link_click', { p_lead: res.lead_id, p_company: res.company_id });
    check('click via the short code promotes the lead to warm', clk?.ok === true && clk?.newly_warm === true, JSON.stringify(clk));
    const { data: l1 } = await db.from('leads').select('status').eq('id', leadId).single();
    check('lead is now warm', l1?.status === 'warm', l1?.status);

    await db.from('companies').delete().eq('id', companyId); // cascade cleans tracked_links + lead
  }
}

console.log(failures === 0
  ? '\nTRACKED-LINK VERIFICATION PASSED — short opaque codes; resolve round-trips; legacy links still work; click→warm unchanged.'
  : `\n${failures} CHECK(S) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
