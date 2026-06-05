// Surge — proactive heartbeat verification. Run (dev server up): node scripts/verify-heartbeat.mjs [baseURL]
// Pure planSweep unit checks + a LIVE authed sweep: an overdue lead becomes a recovery
// task, a 90+ day lead is recycled, and a second run is idempotent (no duplicate task).
import { readFileSync } from 'node:fs';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { planSweep } from '../lib/heartbeat.mjs';

const BASE = process.argv[2] || 'http://localhost:3000';
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
let failures = 0;
const check = (n, ok, d) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); if (!ok) failures++; };

console.log('--- 1. planSweep (pure) ---');
const now = Date.parse('2026-06-05T12:00:00Z');
const day = 86_400_000;
const leads = [
  { id: 'a', status: 'qualified', next_action_at: '2026-06-04', created_at: new Date(now - 5 * day).toISOString() },   // overdue, recent
  { id: 'b', status: 'qualified', next_action_at: '2026-06-01', created_at: new Date(now - 100 * day).toISOString() }, // overdue, 90+ → recycle
  { id: 'c', status: 'qualified', next_action_at: '2026-06-09', created_at: new Date(now).toISOString() },             // future → ignore
  { id: 'd', status: 'meeting',   next_action_at: '2026-06-01', created_at: new Date(now - 5 * day).toISOString() },   // booked → ignore
  { id: 'e', status: 'recycled',  next_action_at: '2026-06-01', created_at: new Date(now - 5 * day).toISOString() },   // already recycled → ignore
];
const plan = planSweep(leads, now);
check('flags the overdue recent lead', plan.overdueIds.includes('a') && plan.overdueCount === 1, plan.overdueIds.join(','));
check('recycles the 90+ day overdue lead', plan.recycleIds.includes('b') && plan.recycleCount === 1, plan.recycleIds.join(','));
check('ignores future / booked / already-recycled leads', !['c', 'd', 'e'].some((id) => plan.overdueIds.includes(id) || plan.recycleIds.includes(id)));
check('empty pipeline is a no-op', JSON.stringify(planSweep([], now)) === JSON.stringify({ overdueIds: [], recycleIds: [], overdueCount: 0, recycleCount: 0 }));

console.log('\n--- 2. Live authed sweep ---');
const email = `qa-hb-${Date.now()}@surge-qa.test`;
const password = `Test-${Math.random().toString(36).slice(2)}A1!`;
const store = new Map();
const ssr = createServerClient(URL, ANON, {
  cookies: { getAll: () => [...store.entries()].map(([name, value]) => ({ name, value })), setAll: (cs) => cs.forEach(({ name, value }) => store.set(name, value)) },
});
const db = createClient(URL, ANON);
const cookie = () => [...store.entries()].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join('; ');

const { data: su, error: suErr } = await ssr.auth.signUp({ email, password });
if (suErr || !su.session) { console.log('signup failed:', suErr?.message); process.exit(1); }
await db.auth.signInWithPassword({ email, password });
const { data: co, error: coErr } = await db.from('companies').insert({ user_id: su.user.id, onboarding_complete: true, company_name: 'QA HB Co' }).select('id').single();
if (coErr) { console.log('company insert failed:', coErr.message); process.exit(1); }
const companyId = co.id;
const yest = new Date(Date.now() - day).toISOString().slice(0, 10);
const future = new Date(Date.now() + 5 * day).toISOString().slice(0, 10);
const lead = (over, oldDays) => ({
  company_id: companyId, business_name: 'L' + Math.random().toString(36).slice(2, 7), vertical: 'med_spa', source_url: 'https://example.com',
  score: 80, score_reasons: {}, status: 'qualified', next_action: 'follow up', next_action_at: over ? yest : future,
  created_at: new Date(Date.now() - oldDays * day).toISOString(),
});
const { error: liErr } = await db.from('leads').insert([lead(true, 5), lead(true, 100), lead(false, 1)]);
check('seeded test leads', !liErr, liErr?.message);

async function sweep() {
  const res = await fetch(`${BASE}/api/heartbeat`, { method: 'POST', headers: { Cookie: cookie() } });
  return res.json().catch(() => ({}));
}
const r1 = await sweep();
check('sweep flags 1 overdue + recycles 1 stale', r1.ok && r1.overdueCount === 1 && r1.recycleCount === 1 && r1.taskCreated === true, JSON.stringify(r1));
const { data: tasks1 } = await db.from('tasks').select('id, title').eq('company_id', companyId).eq('project', 'Lead Lifeline');
check('a Lead Lifeline recovery task was created for Aria', (tasks1 ?? []).length === 1, (tasks1 ?? []).map((t) => t.title).join('|'));
const { count: recycled } = await db.from('leads').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'recycled');
check('the 90+ day lead was recycled', recycled === 1, `recycled ${recycled}`);

check('daily cycle deferred while Aria has the recovery task (re-engage first)', r1.dailyCycleQueued === false, `dailyCycleQueued=${r1.dailyCycleQueued}`);

const r2 = await sweep();
const { data: tasks2 } = await db.from('tasks').select('id').eq('company_id', companyId).eq('project', 'Lead Lifeline');
check('second run is idempotent (no duplicate task)', r2.taskCreated === false && (tasks2 ?? []).length === 1, `taskCreated=${r2.taskCreated}, tasks=${(tasks2 ?? []).length}`);

console.log('\n--- 3. Standing daily cycle (idle Aria + a directive) ---');
const { data: co2 } = await db.from('companies').insert({ user_id: su.user.id, onboarding_complete: true, company_name: 'QA Daily Co' }).select('id').single();
const c2 = co2.id;
await db.from('memory_entries').insert({ id: 'm' + Date.now(), company_id: c2, type: 'icp', title: 'ICP', content: 'med spas in Conroe', tags: ['icp'], updated_at: new Date().toISOString().slice(0, 10), sort_order: Date.now() });
// One future (non-overdue) lead so there is no recovery task — Aria is idle.
await db.from('leads').insert({
  company_id: c2, business_name: 'Future Co', vertical: 'med_spa', source_url: 'https://example.com',
  score: 70, score_reasons: {}, status: 'qualified', next_action: 'follow up', next_action_at: future,
});
async function sweep2() { const res = await fetch(`${BASE}/api/heartbeat`, { method: 'POST', headers: { Cookie: cookie() } }); return res.json().catch(() => ({})); }
const d1 = await sweep2();
const { data: dtasks } = await db.from('tasks').select('id').eq('company_id', c2).eq('project', 'Daily Prospecting');
check('idle Aria with an ICP gets a daily prospecting task', d1.dailyCycleQueued === true && (dtasks ?? []).length === 1, `queued=${d1.dailyCycleQueued}, tasks=${(dtasks ?? []).length}`);
const d2 = await sweep2();
const { data: dtasks2 } = await db.from('tasks').select('id').eq('company_id', c2).eq('project', 'Daily Prospecting');
check('daily cycle is idempotent (Aria now busy → no second task)', d2.dailyCycleQueued === false && (dtasks2 ?? []).length === 1, `queued=${d2.dailyCycleQueued}, tasks=${(dtasks2 ?? []).length}`);

for (const id of [companyId, c2]) {
  await db.from('tasks').delete().eq('company_id', id);
  await db.from('leads').delete().eq('company_id', id);
  await db.from('activity_log').delete().eq('company_id', id);
  await db.from('memory_entries').delete().eq('company_id', id);
  await db.from('companies').delete().eq('id', id);
}

console.log(failures === 0 ? '\nHEARTBEAT PASSED — overdue surfaced, stale recycled, idempotent.' : `\n${failures} CHECK(S) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
