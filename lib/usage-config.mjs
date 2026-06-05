// Surge — cost telemetry / model rate card. SINGLE SOURCE OF TRUTH for the per-call
// COST math. Plain .mjs so both routes (TS) and verify scripts (node) import the same
// values. (The old workday QUOTA config lived here too; it was replaced by hours
// metering — see lib/pricing.mjs HOUR_PRICES/ALLOWANCES + lib/hours.mjs. This file is
// now purely cost telemetry, which is the pricing source the hour prices peg to.)

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
