// Surge — usage quotas + cost model. SINGLE SOURCE OF TRUTH for limits and rates.
// Plain .mjs so both app/api/agent/run/route.ts and scripts/verify-usage-limits.mjs
// import the exact same values (the lib/chat-prompt.mjs pattern) — config can't drift.
//
// LIMITS ARE CONFIG, NOT CONSTANTS: one object per plan tier. Raising a quota later
// is a data change here, never a code/deploy change. Limits are permanent at every
// tier — we only ever raise them.

/** Per-plan monthly/daily quotas, keyed by plan tier. */
export const PLAN_QUOTAS = {
  // The workday every employee gets today (same across paid tiers for v1 —
  // tiers differ by HEADCOUNT, not by per-employee quota). Add tier overrides here.
  default: { taskRunsPerMonth: 60, autonomousCyclesPerDay: 1, mediaPerMonth: 8 },
  single:  { taskRunsPerMonth: 60, autonomousCyclesPerDay: 1, mediaPerMonth: 8 },
  team:    { taskRunsPerMonth: 60, autonomousCyclesPerDay: 1, mediaPerMonth: 8 },
};

/** Quota object for a plan, falling back to `default` for unknown/empty plans. */
export function quotaForPlan(plan) {
  return PLAN_QUOTAS[plan] ?? PLAN_QUOTAS.default;
}

/** Anthropic list pricing, USD per 1M tokens, by model. Rate changes live here so
 *  historical usage_log.est_cost_usd is never rewritten. */
export const MODEL_RATES = {
  'claude-sonnet-4-6': { input: 3, output: 15, cacheRead: 0.30 },
  'claude-haiku-4-5':  { input: 1, output: 5,  cacheRead: 0.10 },
};
/** USD per server-side web search request. */
export const WEB_SEARCH_RATE = 0.01;

// Model routing: cheap research/scoring on Haiku; prospect-facing writing on Sonnet.
export const RESEARCH_MODEL = 'claude-haiku-4-5';
export const WRITING_MODEL = 'claude-sonnet-4-6';

/** Billing month key for a date, e.g. "2026-06". UTC so it's stable across regions. */
export function currentPeriod(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Estimated USD cost of one Anthropic call from its token usage. */
export function estCostUsd({ model, input_tokens = 0, cache_read_tokens = 0, output_tokens = 0, web_searches = 0 }) {
  const r = MODEL_RATES[model];
  if (!r) return +(web_searches * WEB_SEARCH_RATE).toFixed(5);
  const cost =
    (input_tokens / 1e6) * r.input +
    (cache_read_tokens / 1e6) * r.cacheRead +
    (output_tokens / 1e6) * r.output +
    web_searches * WEB_SEARCH_RATE;
  return +cost.toFixed(5);
}

/** In-character "I'm at capacity" message — an UPSELL, never a raw error. The UI shows
 *  this verbatim when a run is refused at quota. No error codes, no stack traces. */
export function capacityMessage(employeeName, quota = PLAN_QUOTAS.default) {
  const name = employeeName || 'Your employee';
  return `${name} here — I've hit my capacity for this month (${quota.taskRunsPerMonth} task runs). ` +
    `Want to add capacity, or bring on another teammate to share the load? Either way I'm back at full speed next month.`;
}
