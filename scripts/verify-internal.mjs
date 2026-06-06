// Surge — internal/owner-unlimited flag verification.
// Run (dev server up): node scripts/verify-internal.mjs [baseURL]
// Grep-proofs run always. Live DB checks run when the internal_flag migration is
// applied. The POSITIVE bypass check (internal never gated) needs a one-off service
// key (SUPABASE_SERVICE_ROLE_KEY=... node scripts/verify-internal.mjs) because, by
// design, an authenticated customer CANNOT set is_internal — that's the whole point,
// and is itself verified here with the anon key (the critical security check).
import { readFileSync } from 'node:fs';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { estimateHours } from '../lib/pricing.mjs';

const BASE = process.argv[2] || 'http://localhost:3000';
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || null;

let failures = 0;
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failures++; };
const skip = (name, why) => console.log(`SKIP  ${name} — ${why}`);

console.log('--- 1. Grep-proofs (bypass + hardening are actually in the code) ---');
const hours = readFileSync('lib/hours.mjs', 'utf8');
check('lib/hours.mjs exports isInternal()', /export async function isInternal\(/.test(hours));
check('gateWork bypasses for internal', /isInternal\(supabase, companyId\)[\s\S]{0,120}internal: true/.test(hours));
check('debitHours is a no-op for internal', /if \(await isInternal\(supabase, companyId\)\) return await getBalance/.test(hours));
const mig = readFileSync('supabase/internal_flag_migration.sql', 'utf8');
check('migration adds is_internal column', /add column if not exists is_internal boolean/.test(mig));
check('migration hardens with the immutability trigger', /trg_protect_is_internal/.test(mig) && /is not user-(settable|modifiable)/.test(mig));

console.log('\n--- 2. Live DB checks (need the internal_flag migration + dev server) ---');
const probe = createClient(URL, ANON);
const { error: colErr } = await probe.from('companies').select('is_internal').limit(1);
if (colErr) {
  skip('self-grant blocked / non-internal gated / internal bypass', 'internal_flag migration not applied — run supabase/internal_flag_migration.sql, then re-run');
} else {
  const email = `qa-internal-${Date.now()}@surge-qa.test`;
  const password = `Test-${Math.random().toString(36).slice(2)}A1!`;
  const store = new Map();
  const ssr = createServerClient(URL, ANON, {
    cookies: { getAll: () => [...store.entries()].map(([name, value]) => ({ name, value })), setAll: (cs) => cs.forEach(({ name, value }) => store.set(name, value)) },
  });
  const db = createClient(URL, ANON);
  const { data: su } = await ssr.auth.signUp({ email, password });
  await db.auth.signInWithPassword({ email, password });
  const cookieHeader = () => [...store.entries()].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join('; ');

  const { data: company } = await db.from('companies').insert({ user_id: su.user.id, onboarding_complete: false, plan: 'single' }).select('id, is_internal').single();
  const companyId = company?.id;

  // 2a. THE security check — a customer must NOT be able to self-grant unlimited.
  check('new company defaults to is_internal=false', company?.is_internal === false, `got ${company?.is_internal}`);
  await db.from('companies').update({ is_internal: true }).eq('id', companyId).then(() => {}, () => {});
  const { data: after } = await db.from('companies').select('is_internal').eq('id', companyId).maybeSingle();
  check('customer CANNOT self-grant is_internal (privilege escalation blocked)', after?.is_internal !== true, `is_internal=${after?.is_internal}`);

  // 2b. Non-internal account is still metered: drain below cost → research refused (402).
  const { data: bal0 } = await db.rpc('hours_balance', { p_company: companyId });
  await db.rpc('hours_append', { p_company: companyId, p_delta: -(Number(bal0) - 0.1), p_reason: 'drain (test)', p_employee: null, p_ref_type: 'grant', p_ref_id: null });
  const lowRes = await fetch(`${BASE}/api/onboard/research`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookieHeader() },
    body: JSON.stringify({ url: 'https://www.anthropic.com' }),
  });
  const lowJson = await lowRes.json().catch(() => ({}));
  check('non-internal still gated (research refused at low balance, 402)', lowRes.status === 402 && lowJson.out_of_hours === true, `status ${lowRes.status}`);

  // 2c. POSITIVE bypass — only verifiable with a one-off service key (customers can't
  // flip the flag, by design). With it: flip internal, leave balance at ~0, and the
  // SAME drained company must now run without being gated.
  if (SERVICE) {
    const svc = createClient(URL, SERVICE);
    await svc.from('companies').update({ is_internal: true }).eq('id', companyId);
    const okRes = await fetch(`${BASE}/api/onboard/research`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookieHeader() },
      body: JSON.stringify({ url: 'https://www.anthropic.com/about' }),
    });
    check('internal account is NEVER gated (runs at zero balance)', okRes.status !== 402, `status ${okRes.status}`);
    await svc.from('companies').delete().eq('id', companyId);
  } else {
    skip('internal bypass (runs at zero balance)', 'no service key — re-run as SUPABASE_SERVICE_ROLE_KEY=... node scripts/verify-internal.mjs (one-off, per token policy)');
    await db.from('companies').delete().eq('id', companyId);
  }
}

console.log(failures === 0 ? '\nINTERNAL-FLAG VERIFICATION PASSED (grep-proofs + live checks where the migration is applied).' : `\n${failures} CHECK(S) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
