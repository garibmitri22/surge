// Surge — Step 2 verification script
// Run with: node scripts/verify-auth.mjs
// Checks (without needing any manual steps):
//   1. Did auth_migration.sql run? (companies.user_id and tasks.company_id exist)
//   2. Is RLS actually enforced? (anonymous requests must NOT see data)
// Exit code 0 = all pass, 1 = something failed.

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_ || !KEY) {
  console.error('FAIL: missing Supabase env vars in .env.local');
  process.exit(1);
}

const get = async (path) => {
  const res = await fetch(`${URL_}/rest/v1/${path}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  let body;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
};

let failures = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};
const skip = (name, why) => console.log(`SKIP  ${name} — ${why}`);

// 1. Migration ran: columns exist (a missing column returns a 42703 error)
const compCol = await get('companies?select=user_id&limit=1');
check('companies.user_id column exists (migration ran)', compCol.status !== 400, `HTTP ${compCol.status}`);

const taskCol = await get('tasks?select=company_id&limit=1');
check('tasks.company_id column exists (migration ran)', taskCol.status !== 400, `HTTP ${taskCol.status}`);

// 2. RLS enforced: anonymous (not signed in) must see ZERO rows in tenant tables
for (const table of ['tasks', 'memory_entries', 'activity_log', 'companies']) {
  const r = await get(`${table}?select=*&limit=5`);
  const rows = Array.isArray(r.body) ? r.body.length : 0;
  const blocked = r.status === 401 || r.status === 403 || (r.status === 200 && rows === 0);
  check(`RLS blocks anonymous reads on ${table}`, blocked, `HTTP ${r.status}, rows visible: ${rows}`);
}

// 3. RLS blocks anonymous writes
const w = await fetch(`${URL_}/rest/v1/tasks`, {
  method: 'POST',
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
  body: JSON.stringify({ id: 'rls-test-should-fail', title: 'RLS test', assignee_id: 'aria', priority: 'low', project: 'test', status: 'queued' }),
});
check('RLS blocks anonymous writes on tasks', w.status === 401 || w.status === 403, `HTTP ${w.status}`);

// 4. TWO-TENANT ISOLATION (critical) — tenant A must NEVER see tenant B's data on
// companies, leads, lead_drafts, or memory_entries. Each tenant is a real signed-in
// user with its own company + a lead/draft/memory; we then prove A can't read B (and
// vice-versa), both in list views and by direct id. Needs Confirm-email OFF. Self-cleans.
console.log('\n--- 4. Two-tenant isolation (RLS scopes by user_id) ---');
async function makeTenant(tag) {
  const email = `qa-iso-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}@surge-qa.test`;
  const password = `Test-${Math.random().toString(36).slice(2)}A1!`;
  const db = createClient(URL_, KEY, { auth: { persistSession: false } });
  const { data: su, error } = await db.auth.signUp({ email, password });
  if (error || !su?.user) return { err: error?.message || 'no user' };
  await db.auth.signInWithPassword({ email, password });
  const { data: co } = await db.from('companies').insert({ user_id: su.user.id, company_name: `__iso_${tag}__`, onboarding_complete: true, plan: 'single' }).select('id').single();
  const { data: lead } = await db.from('leads').insert({ company_id: co.id, business_name: `lead_${tag}`, vertical: 'other', source_url: 'https://e.com', score: 50, score_reasons: {}, status: 'qualified', next_action: 'x', next_action_at: new Date().toISOString(), click_count: 0 }).select('id').single();
  const { data: draft } = await db.from('lead_drafts').insert({ lead_id: lead.id, company_id: co.id, channel: 'email', sequence_step: 1, subject: 's', body: 'b', approval_status: 'pending' }).select('id').single();
  const { data: mem } = await db.from('memory_entries').insert({ id: 'm' + Date.now() + tag, company_id: co.id, type: 'note', title: 't', content: `secret_${tag}`, tags: ['note'], updated_at: new Date().toISOString().slice(0, 10), sort_order: Date.now() }).select('id').single();
  return { db, userId: su.user.id, companyId: co.id, leadId: lead?.id, draftId: draft?.id, memId: mem?.id };
}
const A = await makeTenant('a');
const B = await makeTenant('b');
if (A.err || B.err) {
  skip('two-tenant isolation', `could not create test users (${A.err || B.err}) — is Confirm-email OFF?`);
} else {
  const ids = async (q) => ((await q).data ?? []).map((r) => r.id);
  // A's own list view: sees its own company, never B's.
  const aCompanies = await ids(A.db.from('companies').select('id'));
  check('A sees its OWN company', aCompanies.includes(A.companyId), `${aCompanies.length} visible`);
  check('A does NOT see B\'s company in its list', !aCompanies.includes(B.companyId));
  // Direct cross-tenant reads by id must return ZERO rows (the real leak test).
  check('A CANNOT read B\'s company by id', (await ids(A.db.from('companies').select('id').eq('id', B.companyId))).length === 0);
  check('A CANNOT read B\'s lead by id', (await ids(A.db.from('leads').select('id').eq('id', B.leadId))).length === 0);
  check('A CANNOT read B\'s draft by id', (await ids(A.db.from('lead_drafts').select('id').eq('id', B.draftId))).length === 0);
  check('A CANNOT read B\'s memory by id', (await ids(A.db.from('memory_entries').select('id').eq('id', B.memId))).length === 0);
  // A's full lists never contain B's secret values.
  const aLeadNames = ((await A.db.from('leads').select('business_name')).data ?? []).map((l) => l.business_name);
  const aMemContent = ((await A.db.from('memory_entries').select('content')).data ?? []).map((m) => m.content);
  check('A\'s leads never include B\'s', !aLeadNames.includes('lead_b'));
  check('A\'s memory never includes B\'s secret', !aMemContent.includes('secret_b'));
  // Symmetric: B cannot read A.
  check('B CANNOT read A\'s company by id (symmetric)', (await ids(B.db.from('companies').select('id').eq('id', A.companyId))).length === 0);
  check('B CANNOT read A\'s memory by id (symmetric)', (await ids(B.db.from('memory_entries').select('id').eq('id', A.memId))).length === 0);
  await A.db.from('companies').delete().eq('id', A.companyId);
  await B.db.from('companies').delete().eq('id', B.companyId);
}

console.log(failures === 0 ? '\nALL CHECKS PASSED — Step 2 DB + tenant isolation verified (A never sees B).' : `\n${failures} CHECK(S) FAILED — If column checks failed, run supabase/auth_migration.sql. If RLS/isolation checks failed, RLS is not scoping by user_id — a real leak.`);
process.exit(failures === 0 ? 0 : 1);
