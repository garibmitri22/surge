# Build: Coin metering (supersedes invisible workday caps)

Read CLAUDE.md, MEMORY.md, CEO.md first.

**DECISION (Mitri, June 5):** the invisible "workday" quota model is DEAD. Hand-tuned per-feature parameters (N scans, N runs/mo) are unknowable for us and invisible to customers. Replacement: **one visible currency — coins.** Every unit of real work costs coins, the balance is on the dashboard, and running out is a purchase moment, not a support ticket. This REPLACES the quota enforcement from the usage-limits build; the cost TELEMETRY from that build stays and becomes the pricing source of truth.

## The model
- **Chat is UNLIMITED** (Atlas brainstorms, employee Q&A, intake). Chat costs pennies and is the daily-habit retention engine — never meter it. Abuse backstop: a generous hidden rate limit (e.g. msgs/hour) that a human can't realistically hit, never marketed as a cap.
- **Work costs coins.** Initial prices (v1, tune from telemetry): research scan 2, Aria task run (full prospecting cycle) 10, Nova content deliverable 5, video deliverable 60 (regenerations count), Opus handoff brief 5. A THIN/FAILED action (empty research scan, errored run) charges ZERO coins — customers never pay for our misses.
- **Pegging rule:** coin prices are derived from REAL usage_log data, set so a 100%-burned allowance still leaves ≥70% gross margin at plan price. Re-derive monthly from telemetry; prices live in ONE config (`lib/pricing.ts`, extend the module from the polish pass).
- **Allowances (starting hypothesis, a pricing experiment like the $999 itself):** Team $999/mo → 1,000 coins/mo. Single $399 → 350/mo. Auto-refill monthly, no rollover (v1; revisit if customers complain).
- **Top-ups: BOTH paths.** One-time packs ($25 → 100 coins, $99 → 500 coins) AND "upgrade your plan" for the chronically heavy. Packs are the impulse path Atlas offers in character at the moment of need.

## Build
1. **Credit ledger** — `coin_ledger` table (company_id, delta, balance_after, reason, ref ids, created_at), RLS per company. Monthly allowance grant via the same mechanism (positive delta on billing cycle; for now, a grant on company creation + a manual/cron refresh until Stripe lands). Balance = ledger sum; cache on companies if needed.
2. **Enforcement** — replace the quota check in `/api/agent/run` (and research route, future Nova/video runners) with: estimate coin cost → check balance → run → debit ACTUAL coin cost (0 on thin/failed). One enforcement helper in one module, used everywhere. The workday/quota config + checks are deleted.
3. **UI** — dashboard coin widget: balance, this month's burn by employee, days-till-empty at current pace. Visible but calm (it should feel like a fuel gauge, not a taxi meter). Low-balance state (<15%): Atlas mentions it in his brief, in character, with the top-up offer. /settings shows full ledger history.
4. **In-character upsell** — on insufficient balance, the employee does NOT silently fail: "I'm out of capacity for this month — want me to keep going? Add a coin pack or bump the plan." (per-persona voice, no shame, one line).
5. **Landing/pricing page** — plans now say what's included in plain English ("~100 prospecting runs/mo" style, derived from coin math) + "add more anytime." Kill any "unlimited" implication. Keep the "full workday" feel-language only where it stays TRUE.
6. **Stripe hooks (stub now, wire when billing ships)** — pack SKUs + plan tiers map to ledger grants. Until Stripe: a dev script grants coins so testing works.
7. **Verify** — `verify-coins.mjs`: balance gates a run; thin scan debits 0; debit matches telemetry-derived price; RLS isolates ledgers; low-balance triggers the brief line; grep-proof: no quota-config references left.

## Interactions with the polish pass
- Polish-pass item 6 (research engine) SIMPLIFIES: the 3-scan cap is replaced by coin cost (2 coins per MEANINGFUL scan, 0 for thin) — keep the direct-page-fetch fix and the no-invented-internals rule, drop the bespoke cap.
- `lib/pricing.ts` from polish-pass item 1 is the home for coin prices + allowances.

## Priority
Behind the email channel (starts the moment domain credentials land), ahead of Stripe (billing should ship WITH coins, not before — coins ARE the thing being billed). The polish pass can merge into this build if you're picking both up together.

Definition of done: build/lint/tsc green, all verify scripts green, commit + push, MEMORY.md updated.
