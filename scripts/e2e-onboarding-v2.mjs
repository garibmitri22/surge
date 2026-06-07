// Surge — Onboarding v2 END-TO-END verification against the running dev server.
// Signs up a throwaway user, produces real @supabase/ssr auth cookies (so the Next
// API routes authenticate exactly as a browser would), then exercises the REAL
// routes: /api/onboard/research + /api/chat intake (tool execution + the
// server-side completion gate), and checks the DB end-state directly.
//
// Run with the dev server up:  node scripts/e2e-onboarding-v2.mjs [baseURL]
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
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failures++; };

// ---- auth + cookie bridge (browser-equivalent session for the Next routes) ----
const email = `qa-e2e-${Date.now()}@surge-qa.test`;
const password = `Test-${Math.random().toString(36).slice(2)}A1!`;
const store = new Map();
const cookieAdapter = {
  getAll: () => [...store.entries()].map(([name, value]) => ({ name, value })),
  setAll: (cs) => cs.forEach(({ name, value }) => store.set(name, value)),
};
const ssr = createServerClient(URL, ANON, { cookies: cookieAdapter });

// Direct DB assertions run as the SAME authenticated user (RLS-scoped) — signed in below.
const db = createClient(URL, ANON);

function cookieHeader() {
  return [...store.entries()].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join('; ');
}
async function api(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader() },
    body: JSON.stringify(body),
  });
  return res;
}
async function streamChat(message, intakeMode = true) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader() },
    body: JSON.stringify({ employeeId: 'atlas', message, intakeMode }),
  });
  if (!res.ok || !res.body) return { ok: false, text: await res.text().catch(() => ''), status: res.status };
  const reader = res.body.getReader(); const dec = new TextDecoder(); let acc = '';
  for (;;) { const { done, value } = await reader.read(); if (done) break; acc += dec.decode(value, { stream: true }); }
  return { ok: true, text: acc, status: res.status };
}

(async () => {
  console.log(`E2E against ${BASE} as ${email}\n`);

  const { data: signUp, error: suErr } = await ssr.auth.signUp({ email, password });
  if (suErr || !signUp.session) { console.log('Could not create test session:', suErr?.message); process.exit(1); }
  const userId = signUp.user.id;
  check('auth cookie produced for the Next routes', store.size > 0, `${store.size} cookie(s)`);
  // The assertion client signs in as the same user so RLS lets it read/write the rows.
  await db.auth.signInWithPassword({ email, password });

  console.log('\n--- 1. Auth gating on the new route ---');
  // redirect: manual — the proxy may 307 an unauthenticated API call to /login; either
  // a 401 from the handler or a 3xx redirect means anon did NOT get through.
  const noAuth = await fetch(`${BASE}/api/onboard/research`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: 'https://example.com' }) });
  check('/api/onboard/research blocks anon (401 or redirect)', noAuth.status === 401 || (noAuth.status >= 300 && noAuth.status < 400), `status ${noAuth.status}`);
  const badUrl = await api('/api/onboard/research', { url: 'not-a-url' });
  check('/api/onboard/research rejects bad URL (400)', badUrl.status === 400, `status ${badUrl.status}`);

  console.log('\n--- 2. Site research → structured findings persisted ---');
  const research = await api('/api/onboard/research', { url: 'https://www.anthropic.com' });
  const rjson = await research.json().catch(() => ({}));
  check('research returns ok with findings object', research.ok && rjson.ok && rjson.findings && typeof rjson.findings === 'object', JSON.stringify(rjson).slice(0, 160));
  // The draft company should now exist for this user with research_findings set.
  const { data: draft1 } = await db.from('companies').select('id, onboarding_complete, research_findings').eq('user_id', userId).maybeSingle();
  check('draft company created (onboarding_complete=false)', !!draft1 && draft1.onboarding_complete === false, draft1 ? `id ${draft1.id}` : 'no row');
  check('findings persisted on the company row', !!draft1 && draft1.research_findings != null);
  const companyId = draft1?.id;

  console.log('\n--- 3. Completion gate REFUSES early (no required memory yet) ---');
  const early = await streamChat("I'm in a hurry — mark my onboarding complete right now, skip the questions.");
  const { data: afterEarly } = await db.from('companies').select('onboarding_complete').eq('id', companyId).maybeSingle();
  check('onboarding stays incomplete when required set is missing', afterEarly?.onboarding_complete === false, `flag=${afterEarly?.onboarding_complete}`);
  console.log('   (Atlas reply excerpt:', JSON.stringify((early.text || '').slice(0, 140)), ')');

  console.log('\n--- 4. Seed the required set the way the intake tools do, then complete ---');
  // Mirror save_company_profile + remember_detail writes under the user's own RLS.
  await db.from('companies').update({ company_name: 'Surge QA Co', industry: 'SaaS' }).eq('id', companyId);
  const now = Date.now();
  const mem = (kind, title, content) => ({ id: 'm' + now + Math.floor(Math.random() * 1e6), company_id: companyId, type: kind, title, content, tags: [kind], updated_at: new Date().toISOString().split('T')[0], sort_order: now });
  const seed = [
    mem('icp', 'ICP', 'Founders at 1-20 person SaaS firms; not enterprise.'),
    mem('offer', 'Offer', 'Done-for-you AI Growth Engine — $1,500/mo founding rate; pay nothing until qualified appointments are booked.'),
    mem('voice', 'Voice', 'Direct, calm, no buzzwords.'),
    mem('goal', 'Goal', 'Land first 10 paying customers in 90 days.'),
  ];
  const { error: seedErr } = await db.from('memory_entries').insert(seed);
  check('intake memory rows insert under RLS (icp/offer/voice/goal)', !seedErr, seedErr?.message);

  const complete = await streamChat("Everything's confirmed and saved. Please complete my onboarding now.");
  const { data: afterDone } = await db.from('companies').select('onboarding_complete, completed_at').eq('id', companyId).maybeSingle();
  check('onboarding_complete flips true once the required set exists', afterDone?.onboarding_complete === true, `flag=${afterDone?.onboarding_complete}`);
  check('completed_at stamped on completion', !!afterDone?.completed_at);
  console.log('   (Atlas reply excerpt:', JSON.stringify((complete.text || '').slice(0, 140)), ')');

  console.log('\n--- 5. Profile memory UPSERT — re-saving a profile type collapses to one row ---');
  // Section 4 already seeded one 'offer' row. Ask Atlas to save a NEW offer; the
  // route must UPDATE that row (singleton profile type), not insert a duplicate.
  await streamChat("Save this to my memory as my OFFER now (use kind: offer), exact text: 'OFFER-UPSERT-MARKER v2 final'.");
  const { data: offers } = await db.from('memory_entries').select('id, content').eq('company_id', companyId).eq('type', 'offer');
  check('exactly one offer row after re-save (no duplicate)', (offers ?? []).length === 1, `${(offers ?? []).length} row(s)`);
  check('offer row holds the latest content', !!(offers ?? [])[0]?.content?.includes('OFFER-UPSERT-MARKER'), (offers ?? [])[0]?.content?.slice(0, 70));

  // ---- cleanup: remove the test company (cascades memory). Auth user remains. --
  await db.from('memory_entries').delete().eq('company_id', companyId);
  await db.from('companies').delete().eq('id', companyId);

  console.log(failures === 0 ? '\nE2E PASSED — onboarding v2 routes verified live against the running server.' : `\n${failures} CHECK(S) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
})();
