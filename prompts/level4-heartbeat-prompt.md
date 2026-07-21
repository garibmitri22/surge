# Kickoff: Level-4 autonomy — the 24/7 heartbeat (FUTURE — prepped + GATED)

First read `NORTH-STAR.md`, `MEMORY.md` (maturity ladder; "NO LEAD WAREHOUSE"; "TARGET A MARKET"), and `CEO.md`. This turns the existing engine into an always-on workforce that works on time/event/state triggers instead of waiting for a click. Surge today = Level 3 (acts on command); this is the jump to Level 4.

**HARD GATE — do NOT enable until all three are true:** (1) product is polished and PROVEN supervised on a real customer (never unleash an unproven loop unsupervised); (2) `CRON_SECRET` + `SUPABASE_SERVICE_ROLE_KEY` are in Vercel (Mitri's manual step — these "wake" the server-side heartbeat); (3) the owner has flipped a specific employee to autonomous. Prepped now, enabled later.

Build on what exists — don't rebuild: `app/api/cron/heartbeat` + `lib/heartbeat.mjs` (currently just the warmup drip), `vercel.json` daily cron, hours metering (the budget that makes autonomy safe).

## The daily cycle (the heartbeat runs server-side, on schedule, per company)
1. **Aria research/score sweep** — top up each company's pipeline toward a target, within the hours budget, scoped to their ICP / active "target market" segments. Fills pipeline; no outward send.
2. **Lead Lifeline sweep** — enforce that every lead has a `next_action` + `next_action_at`; queue/surface overdue follow-ups so nothing goes cold.
3. **Atlas morning brief** — generate the daily brief per company (what happened, what needs you) → dashboard + the weekly briefing path.
4. **Reactive handling** — inbound replies, tracked-link clicks, and bookings trigger the right next step (promote to warm, ping owner) without waiting for the owner.

Triggers: **time** (scheduled), **event** (reply / click / booking), **state** (lead overdue, hours low, task stalled).

## GUARDRAILS (non-negotiable)
- **Hours budget caps everything** — autonomy can never burn unlimited; when low, stop and surface the in-character overtime nudge. `is_internal` bypass.
- **Approval mode holds the line:** outward actions (email/SMS sends) stay gated until the owner flips a specific employee autonomous, per channel. Safe default = **research, scoring, drafting, and internal sweeps run 24/7; SENDS require approval until trusted.** (This is the "wake up to a full pipeline" win without "it emailed people while I slept.")
- **Multi-tenant safe:** the service-role key runs the cron, but every operation is scoped per company; respect tenant isolation.
- **Fail-closed:** any error pauses the cycle — never spam, never overspend, never double-send. Sentry alerts on failures.
- **Idempotent per period** (period key) so a cron retry can't double-run or double-send.
- Consent + 10DLC still apply to any SMS; never auto-contact without a basis. Not a lead warehouse — fills each customer's own exclusive pipeline.

## Mitri's manual steps
Add `CRON_SECRET` + `SUPABASE_SERVICE_ROLE_KEY` to Vercel; pick the cron cadence; flip employees to autonomous when you trust them.

## Definition of done
`build`/`lint`/`tsc` green; entirely dormant until the keys are set (no behavior change before then). Ship `scripts/verify-heartbeat.mjs` proving: the hours budget cap is enforced (autonomy stops when low); NO autonomous send occurs when the employee isn't flipped autonomous; event triggers (reply/click/booking) advance the lead correctly; idempotency blocks double-runs; `is_internal` bypasses metering but not consent. Commit + push, log to `CHANGELOG.md`. Acceptance (Mitri, once gated conditions met): with keys in and an employee flipped, you wake up to a topped-up pipeline + a morning brief, replies/clicks handled overnight — and nothing was sent you didn't authorize.
