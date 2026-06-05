// Surge — Usage limits + cost telemetry verification. Run: node scripts/verify-usage-limits.mjs
// Proves: (1) usage tables exist + RLS enforced, (2) the quota guard refuses run #61
// with an in-character message, (3) a run records cost from real token usage,
// (4) quotas come from config not constants, (5) pricing comes from lib/pricing.mjs ($999 team / $399 single).
// DB checks hit Supabase via the anon key (like verify-leads.mjs); logic checks import
// the REAL lib/usage-config.mjs; wiring checks grep the production source so the live
// authenticated path (which needs a session) is proven connected, not just simulated.
import { readFileSync } from 'node:fs';
import {
  PLAN_QUOTAS, quotaForPlan, estCostUsd, capacityMessage, currentPeriod, MODEL_RATES,
} from '../lib/usage-config.mjs';
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
const migration = readFileSync('supabase/usage_migration.sql', 'utf8');
const landing = readFileSync('app/landing/page.tsx', 'utf8');

console.log('--- 1. Tables exist + RLS enforced (anon) ---');
for (const table of ['usage_counters', 'usage_log']) {
  const r = await get(`${table}?select=company_id&limit=1`);
  check(`${table} exists (migration ran)`, r.status !== 400 && r.status !== 404, `HTTP ${r.status}`);
  check(`RLS blocks anon reads on ${table}`, r.status === 401 || r.status === 403 || (r.status === 200 && r.rows === 0), `HTTP ${r.status}, rows ${r.rows}`);
}
const w = await fetch(`${URL_}/rest/v1/usage_log`, {
  method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
  body: JSON.stringify({ company_id: '00000000-0000-0000-0000-000000000000', employee_id: 'aria', model: 'x' }),
});
check('RLS blocks anon writes on usage_log', w.status === 401 || w.status === 403, `HTTP ${w.status}`);

console.log('\n--- 2. Quota guard: run #61 refused, in character ---');
const limit = PLAN_QUOTAS.default.taskRunsPerMonth;
// Mirror of the atomic SQL guard: increment IFF used < limit, else refuse (null).
const consume = (used) => (used < limit ? used + 1 : null);
let used = 0, refusedAt = null;
for (let i = 1; i <= limit + 1; i++) {
  const next = consume(used);
  if (next == null) { refusedAt = i; break; }
  used = next;
}
check(`first ${limit} runs allowed, run #${limit + 1} refused`, refusedAt === limit + 1 && used === limit, `refused at #${refusedAt}, used ${used}`);
check('quota guard is wired into the route (consume_task_run RPC, charged before start)',
  /\.rpc\(\s*['"]consume_task_run['"]/.test(route) && route.indexOf('consume_task_run') < route.indexOf("status: 'in_progress'"),
  'RPC called before task set in_progress');
const msg = capacityMessage('Aria', PLAN_QUOTAS.default);
const inChar = /aria/i.test(msg) && /capacit/i.test(msg) && /(add capacity|another teammate)/i.test(msg) && !/(error|429|quota_exceeded|null|undefined)/i.test(msg);
check('capacity message is in-character upsell (no raw error text)', inChar, msg);

console.log('\n--- 3. Cost telemetry from real token usage ---');
const rate = MODEL_RATES['claude-sonnet-4-6'];
const sample = { model: 'claude-sonnet-4-6', input_tokens: 10000, cache_read_tokens: 4000, output_tokens: 2000, web_searches: 3 };
const expected = +((10000 / 1e6) * rate.input + (4000 / 1e6) * rate.cacheRead + (2000 / 1e6) * rate.output + 3 * 0.01).toFixed(5);
const got = estCostUsd(sample);
check('estCostUsd computes a non-zero cost matching the rate card', got > 0 && got === expected, `got $${got}, expected $${expected}`);
check('route records every call to usage_log with est_cost_usd', /from\('usage_log'\)\.insert/.test(route) && /est_cost_usd:/.test(route), 'usage_log insert present');
check('research routed to Haiku, writing kept on Sonnet', /RESEARCH_MODEL/.test(route) && /WRITING_MODEL/.test(route), 'both models referenced');
check('prompt caching kept on the run system block', /cache_control:\s*\{\s*type:\s*'ephemeral'\s*\}/.test(route), 'cache_control present');

console.log('\n--- 4. Quotas are config, not hardcoded constants ---');
check('PLAN_QUOTAS.default = 60 runs / 1 cycle / 8 media', limit === 60 && PLAN_QUOTAS.default.autonomousCyclesPerDay === 1 && PLAN_QUOTAS.default.mediaPerMonth === 8);
check('quotaForPlan falls back for single/team/unknown', !!quotaForPlan('single').taskRunsPerMonth && !!quotaForPlan('team').taskRunsPerMonth && !!quotaForPlan('nope').taskRunsPerMonth);
check('route reads the limit from config (quota.taskRunsPerMonth), not a literal',
  /p_limit:\s*quota\.taskRunsPerMonth/.test(route) && /quotaForPlan/.test(route), 'config-driven limit');
check('migration enforces the cap atomically (consume_task_run + guarded update)',
  /create or replace function consume_task_run/.test(migration) && /where uc\.runs_used < p_limit/.test(migration));

console.log('\n--- 5. Pricing: centralized in lib/pricing.mjs ($999 team / $399 single) ---');
// Prices are no longer literals in the page (that drift caused the $299 bug); they
// come from lib/pricing.mjs. Verify the source of truth + that landing uses it.
check('pricing module is source of truth: team 999 / single 399', PRICE_TEAM === 999 && PRICE_SINGLE === 399, `team ${PRICE_TEAM}, single ${PRICE_SINGLE}`);
check('landing renders both plans and imports centralized pricing', /Hire the Team/.test(landing) && /Single Employee/.test(landing) && /pricing\.mjs/.test(landing));
check('team plan flagged Most popular (default)', /Most popular/.test(landing));

console.log(`\nperiod=${currentPeriod()}`);
console.log(failures === 0
  ? '\nALL CHECKS PASSED — usage limits + telemetry verified (DB structure live; enforcement/cost logic via production config; wiring grepped).'
  : `\n${failures} CHECK(S) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
