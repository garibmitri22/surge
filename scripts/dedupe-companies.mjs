// Surge — consolidate duplicate company rows to ONE canonical row per user.
//
// WHY: re-onboarding used to spawn extra company rows under the same user, so different
// surfaces read different rows (dashboard 0s vs /leads 79). This finds users with >1
// company, picks the canonical row (completed onboarding that OWNS the most leads; oldest
// breaks ties), REASSIGNS any orphan leads/drafts to it so nothing is lost, then deletes
// the orphan company rows (cascade removes their stale memory_entries).
//
// SAFE BY DEFAULT — dry-run REPORTS what it would change and deletes NOTHING. Pass --apply
// to make the changes.
//
//   node scripts/dedupe-companies.mjs                 # report only (all users, service role)
//   node scripts/dedupe-companies.mjs --apply         # consolidate
//   QA_EMAIL=.. QA_PASSWORD=.. node scripts/dedupe-companies.mjs   # scope to one signed-in user (no service role)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

// Pick the canonical company for a user's set: completed first, then most leads, then oldest.
export function pickCanonical(companies, leadCountById) {
  return [...companies].sort((a, b) => {
    if (!!b.onboarding_complete !== !!a.onboarding_complete) return (b.onboarding_complete ? 1 : 0) - (a.onboarding_complete ? 1 : 0);
    const lc = (leadCountById[b.id] ?? 0) - (leadCountById[a.id] ?? 0);
    if (lc) return lc;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  })[0];
}

async function main() {
const APPLY = process.argv.includes('--apply');
const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const URL = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

const db = createClient(URL, SERVICE || ANON, { auth: { persistSession: false } });
let scope = 'ALL users (service role)';
if (!SERVICE) {
  if (!process.env.QA_EMAIL || !process.env.QA_PASSWORD) {
    console.log('No SUPABASE_SERVICE_ROLE_KEY. Set it (prod) to scan all users, OR set QA_EMAIL/QA_PASSWORD to scope to one signed-in user (RLS). Exiting.');
    process.exit(0);
  }
  await db.auth.signInWithPassword({ email: process.env.QA_EMAIL, password: process.env.QA_PASSWORD });
  scope = `the signed-in user ${process.env.QA_EMAIL} (RLS-scoped)`;
}

const { data: companies, error } = await db.from('companies').select('id, user_id, company_name, onboarding_complete, created_at');
if (error) { console.log('Query failed:', error.message); process.exit(1); }

const countFor = async (table, id) => (await db.from(table).select('id', { count: 'exact', head: true }).eq('company_id', id)).count ?? 0;
const byUser = new Map();
for (const c of companies ?? []) { (byUser.get(c.user_id) ?? byUser.set(c.user_id, []).get(c.user_id)).push(c); }

console.log(`=== dedupe-companies (${APPLY ? 'APPLY' : 'DRY-RUN'}) — scope: ${scope} ===`);
console.log(`Total companies: ${companies?.length ?? 0} across ${byUser.size} user(s).`);
const dupUsers = [...byUser.entries()].filter(([, rows]) => rows.length > 1);
console.log(`Users with >1 company: ${dupUsers.length}\n`);

let reassignedLeads = 0, reassignedDrafts = 0, deletedCompanies = 0;
for (const [userId, rows] of byUser.entries()) {
  const leadCountById = {};
  for (const c of rows) leadCountById[c.id] = await countFor('leads', c.id);
  const canonical = pickCanonical(rows, leadCountById);
  if (rows.length === 1) continue; // nothing to do for single-company users
  console.log(`USER ${userId} — ${rows.length} companies:`);
  for (const c of rows) {
    const leads = leadCountById[c.id];
    const drafts = await countFor('lead_drafts', c.id);
    const mem = await countFor('memory_entries', c.id);
    const tag = c.id === canonical.id ? 'CANONICAL (keep)' : 'orphan (remove)';
    console.log(`  - [${tag}] ${c.id} "${c.company_name ?? '(draft)'}" complete=${!!c.onboarding_complete} created=${c.created_at} · leads=${leads} drafts=${drafts} memory=${mem}`);
  }
  if (APPLY) {
    const orphans = rows.filter((c) => c.id !== canonical.id);
    for (const o of orphans) {
      // Preserve real pipeline: move orphan leads/drafts onto the canonical row, then delete
      // the orphan company (cascade drops its stale memory_entries).
      const { count: lc } = await db.from('leads').update({ company_id: canonical.id }).eq('company_id', o.id).select('id', { count: 'exact', head: true });
      const { count: dc } = await db.from('lead_drafts').update({ company_id: canonical.id }).eq('company_id', o.id).select('id', { count: 'exact', head: true });
      reassignedLeads += lc ?? 0; reassignedDrafts += dc ?? 0;
      await db.from('companies').delete().eq('id', o.id);
      deletedCompanies++;
    }
    console.log(`  → consolidated to ${canonical.id}.`);
  }
  console.log('');
}

console.log(APPLY
  ? `APPLIED — reassigned ${reassignedLeads} lead(s) + ${reassignedDrafts} draft(s), deleted ${deletedCompanies} orphan company row(s) (their stale memory cascaded out).`
  : `DRY-RUN — nothing changed. Re-run with --apply to consolidate. (Reassigns orphan leads/drafts to the canonical row, then deletes the orphan rows.)`);
}

// Only run when executed directly — importing (e.g. a test importing pickCanonical) must not
// trigger the whole job.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
