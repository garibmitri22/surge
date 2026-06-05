# Build: Post-acceptance-test polish pass (June 5)

Read CLAUDE.md, MEMORY.md, CEO.md first. The onboarding acceptance test PASSED (Mitri re-onboarded as Surge, customer #1 — brain verified in /memory). This pass closes the issues it surfaced plus two voice-quality mandates from Mitri. No new features. Six items, smallest first.

## 0. Sweep uncommitted Cowork fixes into your first commit
Cowork (PM) made live edits that are NOT committed yet:
- `app/memory/page.tsx` — /memory crashed on new intake memory types (`typeLabels[type].slice` on undefined). Fixed with `colorFor()`/`labelFor()` fallbacks + `(entry.tags ?? [])` guard. Keep the fix.
- `components/Sidebar.tsx`, `app/workforce/page.tsx` (×2), `app/api/agent/run/route.ts` — stale $299 pricing → $399/agent + $999 team. Keep these too.
Verify they build, then commit them with item 1.

## 1. Centralize pricing in ONE module
The $299 bug existed because prices are scattered string literals. Create `lib/pricing.ts`:
```ts
export const PRICE_SINGLE = 399;
export const PRICE_TEAM = 999;
export const PRICE_HUMAN_ANCHOR = '$50K';
```
Replace every hardcoded price in components/pages/API prompts/personas Layer 2 with imports (or template injection where it's prompt text). Grep-proof: `grep -rn "299\|\$399\|\$999" app components lib personas` should show only `lib/pricing.ts` imports/injections (and historical docs).

## 2. Fix duplicate profile memory entries (intake upsert)
The intake saved TWO "Offer — Surge" entries (an early "Transformation TBD" draft + the final). `save_company_profile` must UPSERT per (company_id, type) for profile types (icp/offer/voice/goal/brand): update the existing entry's content instead of inserting a new row. Clean up Mitri's duplicate (keep the complete one, delete the TBD one) via a small migration or script. Extend verify-onboarding-v2.mjs: saving the same profile type twice yields ONE row with the latest content.

## 3. Dashboard fake stats — honest empty states (HARD GATE before billing)
Fresh company currently shows invented results: $184K revenue influenced, 28 meetings booked, 94 leads, 47h saved, Workforce Score 86 "+4 pts vs last week". Same never-invent-metrics violation as the briefing page. Fix BOTH dashboard and briefing in this pass:
- Every metric card computes from real data (tasks, leads, activity_log, usage) scoped to the company; zero shows as honest zero with a short "Aria hasn't started prospecting yet"-style line, never a fake number.
- Workforce Score: until the real score formula ships, show "—" with "Score unlocks after your team's first week" — never a mock 86.
- Grep-proof: no mock stat constants imported by dashboard/briefing.

## 4. Voice rule: kill the em-dash habit (all four personas)
Mitri's read: heavy "—" usage = generic AI voice. Add to the SHARED style rules in `lib/chat-prompt.mjs` (so it applies to every employee + intake), not per-persona:
- Max ONE em-dash per reply; prefer commas, periods, or restructuring.
- Short sentences. Concrete specifics from the company brain over abstract filler.
- Never bullet-point a reply that should be two sentences.
Add a verify check: run the existing persona test prompts, fail if any reply contains 3+ em-dashes.

## 5. Atlas: work the problem, don't re-ask stock questions
Mitri's mandate: Atlas must ask the right question for the moment, not the same script every time. In atlas.md + the intake/chat prompt rules:
- Before asking ANYTHING, check the memory layer + board; NEVER ask what the brain already knows (e.g. don't re-ask the ICP that's on file; instead probe the gap: "Your ICP says high-ticket owners, but our GTM list is med spas in North Houston. Which do I tell Aria?").
- Each question must reference why he's asking it NOW (from board state, a prior answer, or a gap).
- One question at a time stays law.
Add a verify scenario: feed Atlas a filled brain + a contradiction; pass = he surfaces the contradiction instead of asking a stock question.

## 6. Research engine: loosen the one-scan cap + fetch pages directly
`app/api/onboard/research/route.ts` is too strict (Mitri's call, June 5):
- **Bug: a thin/empty scan is cached forever as "done"** (findings `{}` persisted → `cached != null` short-circuits every future call). A customer who pastes a wrong/unindexed URL first gets a permanently blind Atlas. Fix: only a scan with MEANINGFUL findings (e.g. company_name or what_they_sell non-empty) consumes the cap; empty results are NOT persisted as final.
- **New cap: 3 successful scans per company** (covers corrected URLs + extra properties), keyed so a NEW url may trigger a fresh scan but the same URL returns cache. All runs still log to usage_log.
- **Fetch the URL directly first** (server-side GET, extract title/meta/visible text — cap response size), THEN web_search to fill gaps. web_search alone can't see unindexed sites or Facebook pages.
- Keep a hard backstop: max scans/day per company so no loop can leak spend.
- Atlas's explanation when a scan is thin must be plain honesty ("my scan of that site came up short, let me just ask you") — he must NEVER invent internals (no "pre-session crawl" lore). Add to the intake prompt rules + a verify assertion.

## 7. ICP reconciliation task (data, not code)
Mitri's onboarding ICP ("high-ticket earners, kept open") is broader than the GTM ICP on file (med spas / real estate / gyms, North Houston→Conroe). After item 5 ships, Atlas should surface this to Mitri in his next brief. If that's not cheap, log it and Mitri will reconcile manually in chat.

## Definition of done
build + lint + tsc green, all existing verify scripts green, the two new verify checks green, grep-proofs pass, ONE commit per item (or logical group), PUSH to origin. Update MEMORY.md with what shipped.

Priority note: this pass is allowed because it's small. The email channel still starts the moment Mitri hands over sending-domain credentials, and that outranks everything here except item 0/1.
