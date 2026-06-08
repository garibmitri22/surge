// Surge — pricing. SINGLE SOURCE OF TRUTH for every price the product quotes.
//
// WHY THIS EXISTS: prices used to be scattered string literals across pages, API
// prompts, and personas. That drift shipped the wrong price to real prospects. One
// module, imported everywhere, kills it — and keeps the dead figures out of the source.
//
// WHY .mjs (not .ts): this is imported by BOTH TypeScript (pages, API routes) and
// plain Node (lib/chat-prompt.mjs + the verify-*.mjs scripts that load personas).
// Plain ESM is the only form all of them can import — same reasoning as
// lib/usage-config.mjs. TS files import it fine.

// ---- THE ONE OFFER ---------------------------------------------------------
// The old per-employee / per-team plan menu (single + team, plus individual AI employees)
// is DEAD. There is exactly one offer now: a done-for-you AI Growth Engine, founding rate,
// billed only after it books real appointments. Nothing in the product may resurrect the
// old plan prices — not even in a comment, so a copy-paste can never reintroduce them.
export const PRICE_FOUNDING = 1500;        // founding rate, $/month — locked for life
export const PRICE_STANDARD_LOW = 2500;    // standard rate range, low end
export const PRICE_STANDARD_HIGH = 5000;   // standard rate range, high end
export const PRICE_FLOOR = 997;            // never quote below this
export const PRICE_HUMAN_ANCHOR = '$50K';  // what ONE human hire costs per year — the value anchor
export const OFFER_NAME = 'Done-for-you AI Growth Engine';
// The gate IS the pitch — no risk until it works.
export const PRICE_GATE = 'You pay nothing until qualified appointments are booked on your calendar.';

// Display strings (keep the "$" + formatting in one place).
export const FOUNDING_LABEL = '$1,500';             // founding monthly rate
export const STANDARD_RANGE_LABEL = '$2,500–5,000'; // standard monthly range
export const FOUNDING_LINE = '$1,500/mo founding rate, locked for life';

// Template injection for prompt text (personas + API prompts) that can't import a
// constant. Authors write {{OFFER_NAME}} / {{PRICE_FOUNDING}} / {{FOUNDING_LINE}} /
// {{PRICE_STANDARD}} / {{PRICE_GATE}} / {{PRICE_HUMAN_ANCHOR}}; this swaps in the live
// values. The OLD {{PRICE_SINGLE}}/{{PRICE_TEAM}} tokens are deliberately collapsed to the
// one founding rate so a stale persona can NEVER resurrect an old plan price.
export function injectPricing(text) {
  if (!text) return text;
  return String(text)
    .replaceAll('{{OFFER_NAME}}', OFFER_NAME)
    .replaceAll('{{PRICE_FOUNDING}}', FOUNDING_LABEL)
    .replaceAll('{{FOUNDING_LINE}}', FOUNDING_LINE)
    .replaceAll('{{PRICE_STANDARD}}', STANDARD_RANGE_LABEL)
    .replaceAll('{{PRICE_GATE}}', PRICE_GATE)
    .replaceAll('{{PRICE_HUMAN_ANCHOR}}', PRICE_HUMAN_ANCHOR)
    // Back-compat guardrail: lingering old tokens resolve to the founding rate, never an old price.
    .replaceAll('{{PRICE_SINGLE}}', FOUNDING_LABEL)
    .replaceAll('{{PRICE_TEAM}}', FOUNDING_LABEL);
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

// Voice (ElevenLabs TTS) is billed by ElevenLabs per CHARACTER, so we meter it per
// character too — not a flat per-speak fee. Calibrated so a typical spoken reply
// (~400 chars) costs a small fraction of an hour, dwarfed by real work like aria_run=2h.
// A failed/empty speak charges ZERO (enforced at the call site).
export const TTS_HOURS_PER_1K_CHARS = 0.1;

/** Hour cost of speaking `charCount` characters aloud (0 for empty). 3-dp precision so
 *  short replies still register a real, non-zero debit on the ledger. */
export function ttsHours(charCount) {
  const c = Math.max(0, Math.floor(Number(charCount) || 0));
  if (c === 0) return 0;
  return Math.round((c / 1000) * TTS_HOURS_PER_1K_CHARS * 1000) / 1000;
}

// Speech-to-text (Deepgram) is billed per MINUTE of audio (~$0.005/min) — a minor COGS line
// next to ElevenLabs output, but metered for completeness and a single honest ledger. A
// failed transcription charges ZERO (enforced at the call site).
export const STT_HOURS_PER_MIN = 0.01;

/** Hour cost of transcribing `seconds` of audio (0 for none). 3-dp so a short utterance
 *  still registers a real, tiny debit. */
export function sttHours(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  if (s === 0) return 0;
  return Math.round((s / 60) * STT_HOURS_PER_MIN * 1000) / 1000;
}

// Hours charged per unit of real WORK. Chat is never metered. A thin/failed action
// charges ZERO (handled at the call site) — customers never pay for our misses.
export const HOUR_PRICES = {
  research_scan: 0.5, // a meaningful onboarding site scan
  aria_run: 2,        // a full prospecting cycle (research + score + draft)
  nova_content: 1,    // a content deliverable
  nova_video: 12,     // a video deliverable (regenerations count)
  opus_brief: 1,      // a handoff brief
  inbound_conversation: 0.5, // one live inbound lead conversation (debited once per lead, not per message)
  reactivation_run: 1,       // one reactivation drafting batch over the owner's existing list
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
