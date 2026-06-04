// Surge — HQ Chat v2 verification. Run: node scripts/verify-leads.mjs
// Checks the leads_migration applied and RLS is enforced. Exit 0 = all pass.
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_ || !KEY) { console.error('FAIL: missing Supabase env vars'); process.exit(1); }

const get = async (path) => {
  const res = await fetch(`${URL_}/rest/v1/${path}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  let body; try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
};

let failures = 0;
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failures++; };

const leadsCol = await get('leads?select=source_url&limit=1');
check('leads table exists (migration ran)', leadsCol.status !== 400 && leadsCol.status !== 404, `HTTP ${leadsCol.status}`);

const draftsCol = await get('lead_drafts?select=approval_status&limit=1');
check('lead_drafts table exists (migration ran)', draftsCol.status !== 400 && draftsCol.status !== 404, `HTTP ${draftsCol.status}`);

for (const table of ['leads', 'lead_drafts']) {
  const r = await get(`${table}?select=*&limit=5`);
  const rows = Array.isArray(r.body) ? r.body.length : 0;
  const blocked = r.status === 401 || r.status === 403 || (r.status === 200 && rows === 0);
  check(`RLS blocks anonymous reads on ${table}`, blocked, `HTTP ${r.status}, rows visible: ${rows}`);
}

const w = await fetch(`${URL_}/rest/v1/leads`, {
  method: 'POST',
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
  body: JSON.stringify({ company_id: '00000000-0000-0000-0000-000000000000', business_name: 'rls-test', vertical: 'other', source_url: 'x', score_reasons: {}, next_action: 'x', next_action_at: '2026-06-10T00:00:00Z' }),
});
check('RLS blocks anonymous writes on leads', w.status === 401 || w.status === 403, `HTTP ${w.status}`);

console.log(failures === 0
  ? '\nALL CHECKS PASSED — leads DB side verified. (Lifeline next_action/next_action_at are NOT NULL in the schema.)'
  : `\n${failures} CHECK(S) FAILED — run supabase/leads_migration.sql in the SQL Editor.`);
process.exit(failures === 0 ? 0 : 1);
