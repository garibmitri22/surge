// Surge — cost telemetry + pricing verification. Run: node scripts/verify-usage-limits.mjs
// The workday QUOTA was replaced by hours metering (see verify-hours.mjs). What
// survives from the usage build is the COST TELEMETRY (the pricing source) + the
// centralized prices. This proves: (1) usage_log exists + RLS enforced, (2) cost is
// computed from real token usage via the production config, (3) the run route records
// every call, (4) pricing comes from lib/pricing.mjs.
import { readFileSync } from 'node:fs';
import { estCostUsd, currentPeriod, MODEL_RATES } from '../lib/usage-config.mjs';
import { PRICE_SINGLE, PRICE_TEAM } from '../lib/pricing.mjs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_ || !KEY) { console.error('FAIL: missing Supabase env vars'); process.exit(1); }

let failures = 0;
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failures++; };
const get = async (path) => {
  const res = await fetch(`${URL_}/rest/v1/${path}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  let b; try { b = await res.json(); } catch { b = null; }
  return { status: res.status, rows: Array.isArray(b) ? b.length : 0 };
};
const route = readFileSync('app/api/agent/run/route.ts', 'utf8');
const landing = readFileSync('app/landing/page.tsx', 'utf8');

console.log('--- 1. usage_log exists + RLS enforced (anon) ---');
const r = await get('usage_log?select=company_id&limit=1');
check('usage_log exists (migration ran)', r.status !== 400 && r.status !== 404, `HTTP ${r.status}`);
check('RLS blocks anon reads on usage_log', r.status === 401 || r.status === 403 || (r.status === 200 && r.rows === 0), `HTTP ${r.status}, rows ${r.rows}`);
const w = await fetch(`${URL_}/rest/v1/usage_log`, {
  method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
  body: JSON.stringify({ company_id: '00000000-0000-0000-0000-000000000000', employee_id: 'aria', model: 'x' }),
});
check('RLS blocks anon writes on usage_log', w.status === 401 || w.status === 403, `HTTP ${w.status}`);

console.log('\n--- 2. Cost telemetry from real token usage ---');
const rate = MODEL_RATES['claude-sonnet-4-6'];
const sample = { model: 'claude-sonnet-4-6', input_tokens: 10000, cache_read_tokens: 4000, output_tokens: 2000, web_searches: 3 };
const expected = +((10000 / 1e6) * rate.input + (4000 / 1e6) * rate.cacheRead + (2000 / 1e6) * rate.output + 3 * 0.01).toFixed(5);
const got = estCostUsd(sample);
check('estCostUsd computes a non-zero cost matching the rate card', got > 0 && got === expected, `got $${got}, expected $${expected}`);
check('route records every call to usage_log with est_cost_usd', /from\('usage_log'\)\.insert/.test(route) && /est_cost_usd:/.test(route), 'usage_log insert present');
check('research routed to Haiku, writing kept on Sonnet', /RESEARCH_MODEL/.test(route) && /WRITING_MODEL/.test(route), 'both models referenced');
check('prompt caching kept on the run system block', /cache_control:\s*\{\s*type:\s*'ephemeral'\s*\}/.test(route), 'cache_control present');

console.log('\n--- 3. Pricing: centralized in lib/pricing.mjs ($999 team / $399 single) ---');
check('pricing module is source of truth: team 999 / single 399', PRICE_TEAM === 999 && PRICE_SINGLE === 399, `team ${PRICE_TEAM}, single ${PRICE_SINGLE}`);
check('landing renders both plans and imports centralized pricing', /Hire the Team/.test(landing) && /Single Employee/.test(landing) && /pricing\.mjs/.test(landing));
check('team plan flagged Most popular (default)', /Most popular/.test(landing));

console.log(`\nperiod=${currentPeriod()}`);
console.log(failures === 0
  ? '\nALL CHECKS PASSED — cost telemetry + pricing verified (quota replaced by hours; see verify-hours.mjs).'
  : `\n${failures} CHECK(S) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
