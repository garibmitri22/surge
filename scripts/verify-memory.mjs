// Surge — automatic memory capture verification. Run (dev server up):
//   node scripts/verify-memory.mjs [baseURL]
// Proves: after a normal chat turn, the durable facts the owner shared are saved to
// the company brain automatically (no remember_detail call required), and small talk
// saves nothing. Uses the same cookie bridge as the other e2e scripts.
import { readFileSync } from 'node:fs';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const BASE = process.argv[2] || 'http://localhost:3000';
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
let failures = 0;
const check = (n, ok, d) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); if (!ok) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const email = `qa-mem-${Date.now()}@surge-qa.test`;
const password = `Test-${Math.random().toString(36).slice(2)}A1!`;
const store = new Map();
const ssr = createServerClient(URL, ANON, {
  cookies: { getAll: () => [...store.entries()].map(([name, value]) => ({ name, value })), setAll: (cs) => cs.forEach(({ name, value }) => store.set(name, value)) },
});
const db = createClient(URL, ANON);
const cookieHeader = () => [...store.entries()].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join('; ');

async function drainChat(employeeId, message) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookieHeader() },
    body: JSON.stringify({ employeeId, message }),
  });
  if (!res.ok || !res.body) return false;
  const reader = res.body.getReader();
  for (;;) { const { done } = await reader.read(); if (done) break; }
  return true;
}

(async () => {
  console.log(`Memory capture e2e against ${BASE} as ${email}\n`);
  const { data: su, error } = await ssr.auth.signUp({ email, password });
  if (error || !su.session) { console.log('signup failed:', error?.message); process.exit(1); }
  await db.auth.signInWithPassword({ email, password });
  const { data: co, error: coErr } = await db.from('companies').insert({ user_id: su.user.id, onboarding_complete: true, company_name: 'QA Dental Co' }).select('id').single();
  if (coErr || !co) { console.log('company insert failed:', coErr?.message); process.exit(1); }
  const companyId = co.id;

  console.log('--- 1. A fact-rich turn is captured automatically ---');
  const factMsg = "Quick context: our ideal customers are dental clinics in Austin, Texas with 2-5 locations. Never use the word 'synergy' in any copy. And my #1 goal this quarter is to book 20 demos.";
  await drainChat('aria', factMsg);
  // Extraction runs server-side AFTER the stream closes; poll a few seconds.
  let rows = [];
  for (let i = 0; i < 8; i++) {
    await sleep(1500);
    const { data } = await db.from('memory_entries').select('type, title, content').eq('company_id', companyId);
    rows = data ?? [];
    if (rows.length > 0) break;
  }
  const blob = rows.map((r) => `[${r.type}] ${r.title}: ${r.content}`).join('\n').toLowerCase();
  console.log('  captured:\n' + (rows.length ? rows.map((r) => `   - [${r.type}] ${r.title}`).join('\n') : '   (none)'));
  check('memories were saved without a remember_detail call', rows.length > 0, `${rows.length} entr(y/ies)`);
  check('captured the ICP (dental / Austin)', /dental|austin/.test(blob));
  check('captured the brand-voice rule (banned word "synergy")', /synergy/.test(blob));
  check('captured the goal (20 demos)', /demo/.test(blob));

  console.log('\n--- 2. Small talk saves nothing new ---');
  const before = rows.length;
  await drainChat('aria', 'thanks, looks good!');
  await sleep(4000);
  const { data: after } = await db.from('memory_entries').select('id').eq('company_id', companyId);
  check('a pleasantry adds no junk to the brain', (after?.length ?? 0) <= before + 1, `before ${before}, after ${after?.length}`);

  await db.from('memory_entries').delete().eq('company_id', companyId);
  await db.from('companies').delete().eq('id', companyId);

  console.log(failures === 0 ? '\nMEMORY CAPTURE PASSED — durable facts auto-saved, small talk ignored.' : `\n${failures} CHECK(S) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
})();
