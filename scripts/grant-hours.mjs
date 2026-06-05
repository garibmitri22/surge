// Surge — DEV tool: grant hours to a company (until Stripe drives overtime/refills).
// Usage: node scripts/grant-hours.mjs <email> <password> <hours> [reason]
// Signs in as the user (so RLS scopes the write) and appends a positive ledger entry.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const [email, password, hoursArg, ...reasonParts] = process.argv.slice(2);
if (!email || !password || !hoursArg) {
  console.error('Usage: node scripts/grant-hours.mjs <email> <password> <hours> [reason]');
  process.exit(1);
}
const hours = Number(hoursArg);
const reason = reasonParts.join(' ') || 'Manual grant (dev)';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const { error: authErr } = await sb.auth.signInWithPassword({ email, password });
if (authErr) { console.error('Sign-in failed:', authErr.message); process.exit(1); }

const { data: company } = await sb.from('companies').select('id, company_name').order('created_at', { ascending: false }).limit(1).maybeSingle();
if (!company) { console.error('No company found for this user.'); process.exit(1); }

const { data: balance, error } = await sb.rpc('hours_append', {
  p_company: company.id, p_delta: hours, p_reason: reason, p_ref_type: 'grant', p_ref_id: null,
});
if (error) { console.error('Grant failed:', error.message); process.exit(1); }
console.log(`Granted ${hours}h to ${company.company_name || company.id}. New balance: ${balance}h.`);
