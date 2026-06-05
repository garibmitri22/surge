# Build: Hours metering (supersedes invisible workday caps)

Read CLAUDE.md, MEMORY.md, CEO.md first.

**DECISION (Mitri, June 5):** the invisible "workday" quota model is DEAD. Hand-tuned per-feature parameters (N scans, N runs/mo) are unknowable for us and invisible to customers. Replacement: **one visible currency, branded as HOURS.** Every unit of real work costs hours of the employee's time, the balance is on the dashboard, and running out is a purchase moment, not a support ticket. This REPLACES the quota enforcement from the usage-limits build; the cost TELEMETRY from that build stays and becomes the pricing source of truth.

**BRANDING (Mitri approved June 5): the currency is "hours", never "credits"/"coins"/"tokens".** We sell employees; employees work hours. "This prospecting run took Aria 2 hours" — not "10 credits". A top-up is **overtime**. UI copy, persona language, landing page, ledger UI: hours everywhere. Internal table/code names may say `hours_ledger` etc.; customer-facing words are hours/overtime only. Psychology: a team's time is understood and not resented; arcade tokens feel like nickel-and-diming.

## The model
- **Chat is UNLIMITED** (Atlas brainstorms, employee Q&A, intake). Chat costs pennies and is the daily-habit retention engine — never meter it. Talking to your team is free; their time goes to WORK. Abuse backstop: a generous hidden rate limit (e.g. msgs/hour) that a human can't realistically hit, never marketed as a cap.
- **Work costs hours.** Initial prices (v1, tune from telemetry): research scan 0.5h, Aria task run (full prospecting cycle) 2h, Nova content deliverable 1h, video deliverable 12h (regenerations count), Opus handoff brief 1h. A THIN/FAILED action (empty research scan, errored run) charges ZERO — customers never pay for our misses.
- **Pegging rule:** hour prices are derived from REAL usage_log data, set so a 100%-burned allowance still leaves ≥70% gross margin at plan price. Re-derive monthly from telemetry; prices live in ONE config (`lib/pricing.ts`, extend the module from the polish pass).
- **Allowances (starting hypothesis, a pricing experiment like the $999 itself):** Team $999/mo → 200 hours/mo (a real month of team time — reads like a staffing plan, not a phone plan). Single $399 → 70 hours/mo. Auto-refill monthly, no rollover (v1; revisit if customers complain).
- **Top-ups = OVERTIME: BOTH paths.** One-time overtime packs ($25 → 20 hours, $99 → 100 hours) AND "upgrade your plan" for the chronically heavy. Packs are the impulse path Atlas offers in character at the moment of need ("the team can put in overtime this month, or we make this the new normal").

## Build
1. **Hours ledger** — `hours_ledger` table (company_id, delta, balance_after, reason, ref ids, created_at), RLS per company. Monthly allowance grant via the same mechanism (positive delta on billing cycle; for now, a grant on company creation + a manual/cron refresh until Stripe lands). Balance = ledger sum; cache on companies if needed. Fractional hours supported (numeric, 1 decimal).
2. **Enforcement** — replace the quota check in `/api/agent/run` (and research route, future Nova/video runners) with: estimate hour cost → check balance → run → debit ACTUAL cost (0 on thin/failed). One enforcement helper in one module, used everywhere. The workday/quota config + checks are deleted.
3. **UI** — dashboard hours widget: balance ("142h of team time left this month"), this month's hours by employee, days-till-empty at current pace. Visible but calm (a fuel gauge, not a taxi meter). Low-balance state (<15%): Atlas mentions it in his brief, in character, with the overtime offer. /settings shows the full timesheet (ledger history). Activity feed entries can show hours worked ("Aria — prospecting run, 2h").
4. **In-character upsell** — on insufficient balance, the employee does NOT silently fail: "I'm out of hours this month — want the team to put in overtime, or should we make this pace the new plan?" (per-persona voice, no shame, one line).
5. **Landing/pricing page** — plans now say what's included in plain English ("200 hours of team time a month — about 100 prospecting runs" style, derived from the hour math) + "overtime anytime." Kill any "unlimited" implication. Keep the "full workday" feel-language only where it stays TRUE.
6. **Stripe hooks (stub now, wire when billing ships)** — overtime pack SKUs + plan tiers map to ledger grants. Until Stripe: a dev script grants hours so testing works.
7. **Verify** — `verify-hours.mjs`: balance gates a run; thin scan debits 0; debit matches telemetry-derived price; RLS isolates ledgers; low-balance triggers the brief line; grep-proof: no quota-config references left AND no customer-facing "credit"/"coin"/"token" strings anywhere.

## Interactions with the polish pass
- Polish-pass item 6 (research engine) SIMPLIFIES: the 3-scan cap is replaced by hour cost (0.5h per MEANINGFUL scan, 0 for thin) — keep the direct-page-fetch fix and the no-invented-internals rule, drop the bespoke cap.
- `lib/pricing.ts` from polish-pass item 1 is the home for hour prices + allowances.

## Priority
Behind the email channel (starts the moment domain credentials land), ahead of Stripe (billing should ship WITH coins, not before — coins ARE the thing being billed). The polish pass can merge into this build if you're picking both up together.

Definition of done: build/lint/tsc green, all verify scripts green, commit + push, MEMORY.md updated.
