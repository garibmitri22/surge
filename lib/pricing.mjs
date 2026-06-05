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
