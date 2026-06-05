// Surge — pricing. SINGLE SOURCE OF TRUTH for every price the product quotes.
//
// WHY THIS EXISTS: prices were scattered string literals ("$299"/"$399"/"$999")
// across pages, API prompts, and personas. That drift shipped the wrong price to
// real prospects (the $299 bug). One module, imported everywhere, kills it.
//
// WHY .mjs (not .ts): this is imported by BOTH TypeScript (pages, API routes) and
// plain Node (lib/chat-prompt.mjs + the verify-*.mjs scripts that load personas).
// Plain ESM is the only form all of them can import — same reasoning as
// lib/usage-config.mjs. TS files import it fine.

export const PRICE_SINGLE = 399;          // one AI employee, $/month
export const PRICE_TEAM = 999;            // the whole team (Aria+Nova+Opus) run by Atlas, $/month
export const PRICE_HUMAN_ANCHOR = '$50K'; // what ONE human hire costs per year — the value anchor

// Display strings (use these in UI/prose so the "$" lives in one place too).
export const SINGLE_LABEL = `$${PRICE_SINGLE}`;
export const TEAM_LABEL = `$${PRICE_TEAM}`;

// Template injection for prompt text (personas + API prompts) that can't import a
// constant. Authors write {{PRICE_SINGLE}} / {{PRICE_TEAM}} / {{PRICE_HUMAN_ANCHOR}}
// and this swaps in the live values wherever the prompt is assembled.
export function injectPricing(text) {
  if (!text) return text;
  return String(text)
    .replaceAll('{{PRICE_SINGLE}}', SINGLE_LABEL)
    .replaceAll('{{PRICE_TEAM}}', TEAM_LABEL)
    .replaceAll('{{PRICE_HUMAN_ANCHOR}}', PRICE_HUMAN_ANCHOR);
}

// ===========================================================================
// HOURS — the one visible currency (replaces the invisible workday quota).
// Customer-facing word is always "hours" (a top-up is "overtime"); never
// credits/coins/tokens. We sell employees; employees work hours.
//
// PEGGING RULE: hour prices are derived from REAL usage_log telemetry, set so a
// 100%-burned allowance still leaves >=70% gross margin at plan price. These are
// the v1 hypothesis — re-derive monthly from telemetry (scripts/derive-hour-prices.mjs).
// This is the ONE home for hour prices + allowances.
// ===========================================================================

// Hours charged per unit of real WORK. Chat is never metered. A thin/failed action
// charges ZERO (handled at the call site) — customers never pay for our misses.
export const HOUR_PRICES = {
  research_scan: 0.5, // a meaningful onboarding site scan
  aria_run: 2,        // a full prospecting cycle (research + score + draft)
  nova_content: 1,    // a content deliverable
  nova_video: 12,     // a video deliverable (regenerations count)
  opus_brief: 1,      // a handoff brief
};

// Monthly hour allowances by plan (auto-refill, no rollover in v1). Reads like a
// staffing plan, not a phone plan: a real month of team time.
export const ALLOWANCES = {
  single: 70,
  team: 200,
  default: 70,
};

// Overtime packs (the impulse top-up path). Stripe SKUs map to these when billing ships.
export const OVERTIME_PACKS = [
  { id: 'ot20', usd: 25, hours: 20 },
  { id: 'ot100', usd: 99, hours: 100 },
];

/** Hour cost of a unit of work (0 for anything not metered). */
export function estimateHours(action) {
  return HOUR_PRICES[action] ?? 0;
}

/** Monthly allowance for a plan, falling back to the default. */
export function allowanceForPlan(plan) {
  return ALLOWANCES[plan] ?? ALLOWANCES.default;
}

/** Human-facing hours string: "2h", "0.5h", "142h". */
export function formatHours(n) {
  const v = Math.round(Number(n || 0) * 10) / 10;
  return `${Number.isInteger(v) ? v : v.toFixed(1)}h`;
}

/** In-character "out of hours" upsell (no shame, one line). Never a raw error. */
export function overtimeMessage(employeeName, balanceHours = 0) {
  const name = employeeName || 'Your employee';
  return `${name} here. We're out of hours for this month (${formatHours(balanceHours)} left), so I can't start that one yet. ` +
    `Want the team to put in overtime, or should we make this pace the new plan? Either way nothing's lost.`;
}
