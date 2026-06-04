// Surge — Step 2 verification script
// Run with: node scripts/verify-auth.mjs
// Checks (without needing any manual steps):
//   1. Did auth_migration.sql run? (companies.user_id and tasks.company_id exist)
//   2. Is RLS actually enforced? (anonymous requests must NOT see data)
// Exit code 0 = all pass, 1 = something failed.

import { readFileSync } from 'node:fs';

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

console.log(failures === 0 ? '\nALL CHECKS PASSED — Step 2 database side is verified.' : `\n${failures} CHECK(S) FAILED — Step 2 is NOT complete. If column checks failed, run supabase/auth_migration.sql in the Supabase SQL Editor. If RLS checks failed, RLS is not enabled/enforced.`);
process.exit(failures === 0 ? 0 : 1);
