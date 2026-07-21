# Kickoff: Stripe billing + plan selection + entitlement gating

First read `CLAUDE.md`, `MEMORY.md` (see "💰 PRICING & UNIT ECONOMICS" + "🛠️ OPS/BILLING/ADMIN"), and `CEO.md` (Pricing Compression Trap — never compete on price). This is lever 1: until someone can pay, we're guessing. Build on the existing hours/pricing system — do not fork it.

Current state (verified): `lib/pricing.mjs` (`PRICE_SINGLE`=399, `PRICE_TEAM`=999, `ALLOWANCES` single=70/team=200, `OVERTIME_PACKS` ot20 $25→20h / ot100 $99→100h), `lib/hours.mjs` (`gateWork`/`debitHours`/`isInternal`), `hours_ledger` + `hours_append`. `companies.plan` ('single' default | 'team'); the monthly allowance is currently granted by a DB trigger on company create — the migration comment says "until Stripe drives it." That handoff is this task. `companies.is_internal` must bypass ALL billing + gating (Mitri's account stays free).

## Mitri's manual steps (he does these — not the dev, not Cowork)
Create the Stripe account + products/prices in the Stripe dashboard and provide: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, publishable key, and the price IDs for Single ($399/mo), Team ($999/mo), and the two overtime packs ($25 one-time, $99 one-time). He pastes keys into `.env.local` + Vercel himself (never in repo/chat). Do NOT hardcode keys; read from env and no-op gracefully if unset (so dev/build still runs).

## 1. Schema (new migration `supabase/billing_migration.sql` — list it in handoff so Cowork runs it)
- `companies`: add `stripe_customer_id text`, `stripe_subscription_id text`, `subscription_status text` (e.g. trialing/active/past_due/canceled/none, default 'none'), `current_period_end timestamptz`, and `plan_employee text` (which single employee is active when `plan='single'`; null for team).
- Keep `plan` as the source of truth for allowance via `allowanceForPlan(plan)`. RLS consistent with existing tables. Don't break the existing create-time grant for `is_internal`/legacy rows — but real allowance grants now come from Stripe invoice events (below).

## 2. Plan selection + Checkout
- A plan-selection surface (page or step): Single $399 (pick ONE employee) vs Team $999 (Aria+Nova+Opus run by Atlas) vs Enterprise (contact). Frame against the `$50K` human anchor per CEO.md — never apologize for price.
- `app/api/billing/checkout`: creates a Stripe Checkout Session (subscription mode) for the chosen plan, success/cancel URLs back into the app. Reuse/attach `stripe_customer_id`.
- Overtime packs = one-time Checkout (payment mode) for ot20/ot100.

## 3. Webhook `app/api/billing/webhook` (verify signature with `STRIPE_WEBHOOK_SECRET`)
- `checkout.session.completed` / `customer.subscription.created|updated`: set `plan`, `subscription_status`, `stripe_*`, `current_period_end`, and (single) `plan_employee`.
- `invoice.paid`: grant the monthly allowance for the new period via `hours_append` (idempotent per period key, mirror the existing `to_char(now(),'YYYY-MM')` pattern). No rollover (v1).
- `customer.subscription.deleted` / unpaid: set status, stop future grants. Decide downgrade behavior: keep access until `current_period_end`, then gate.
- One-time pack payment: `hours_append` the pack's hours ("Overtime"). Idempotent on event id.

## 4. Entitlement gating (server-enforced, not just UI)
- Single plan → only `plan_employee` is runnable; Team → Aria/Nova/Opus/Atlas all runnable. Block running a non-entitled employee in `app/api/agent/run` and any run path (return an in-character upgrade nudge, never a raw error). `is_internal` bypasses.
- Gate paid work behind an active subscription: no active sub → can't run work (chat stays UNLIMITED per the metering laws — never ration chat). Surface a clean upgrade path, not a dead end.
- Wire `overtimeMessage()` for out-of-hours, and add the Stripe customer-portal link in `/settings` so owners self-manage (`app/api/billing/portal`).

## Definition of done
`build` / `lint` / `tsc` green; everything no-ops cleanly when Stripe keys are unset. Ship `scripts/verify-billing.mjs` proving: `allowanceForPlan` maps single→70/team→200; a simulated `invoice.paid` grants once and is idempotent on replay; entitlement check blocks a non-entitled employee for single and allows all for team; `is_internal` bypasses both gating and metering. (DB is firewalled from Cowork — include "run it + report results" in handoff.) List pending migrations. Commit + push, log to `CHANGELOG.md`.

## NOTE — legal dependency
Per MEMORY, ToS + Privacy + CAN-SPAM is a HARD GATE before the first paying customer. Billing can be built now, but do NOT flip on live charging for real customers until the legal docs are in place (separate track). Use Stripe TEST mode until then.
