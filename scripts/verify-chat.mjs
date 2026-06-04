// Surge — Step 3 verification script
// Run with: node scripts/verify-chat.mjs
// Checks (no manual steps):
//   1. Did chat_migration.sql run? (conversations + messages tables exist)
//   2. Is RLS enforced? (anonymous requests must NOT read or write)
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

// 1. Migration ran: tables/columns exist (a missing table/column returns 400/404)
const convCol = await get('conversations?select=company_id&limit=1');
check('conversations table exists (migration ran)', convCol.status !== 400 && convCol.status !== 404, `HTTP ${convCol.status}`);

const msgCol = await get('messages?select=conversation_id&limit=1');
check('messages table exists (migration ran)', msgCol.status !== 400 && msgCol.status !== 404, `HTTP ${msgCol.status}`);

// 2. RLS enforced: anonymous must see ZERO rows
for (const table of ['conversations', 'messages']) {
  const r = await get(`${table}?select=*&limit=5`);
  const rows = Array.isArray(r.body) ? r.body.length : 0;
  const blocked = r.status === 401 || r.status === 403 || (r.status === 200 && rows === 0);
  check(`RLS blocks anonymous reads on ${table}`, blocked, `HTTP ${r.status}, rows visible: ${rows}`);
}

// 3. RLS blocks anonymous writes on conversations
const w = await fetch(`${URL_}/rest/v1/conversations`, {
  method: 'POST',
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
  body: JSON.stringify({ company_id: '00000000-0000-0000-0000-000000000000', employee_id: 'aria', title: 'rls-test' }),
});
check('RLS blocks anonymous writes on conversations', w.status === 401 || w.status === 403, `HTTP ${w.status}`);

console.log(
  failures === 0
    ? '\nALL CHECKS PASSED — Step 3 database side is verified.'
    : `\n${failures} CHECK(S) FAILED — run supabase/chat_migration.sql in the Supabase SQL Editor (and confirm RLS is enabled).`
);
process.exit(failures === 0 ? 0 : 1);
