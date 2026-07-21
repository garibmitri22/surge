# Kickoff: Weekly CEO Briefing email (the day-14 retention anchor)

First read `CEO.md` (Failure Point #2 "Retention Cliff at Day 14" + "Build the briefing before the feature") and `MEMORY.md`. This is lever 2 (a reason they stay). Per CEO.md: every Monday 8am, Surge emails the owner a one-page summary of what the AI workforce did, what's planned, and what needs attention — "it makes inaction feel like losing money."

Current state (verified): the in-app `/briefing` page exists (`app/briefing/page.tsx`) and already assembles the right data via `lib/data.ts` (`getWorkforceStats`, `getWorkforceScore`, `getTasks`, `getActivity`, `getLeads`, `getDrafts`, `getUserDisplay`). Email sending exists (`lib/email.mjs`, Resend, verified domain). The heartbeat (`app/api/cron/heartbeat`, `lib/heartbeat.mjs`) already runs daily and sends approved lead drafts — extend it; don't build a second scheduler.

## What to build
A weekly owner email that renders the briefing as a clean, real, one-glance summary — reusing the existing briefing data layer (do NOT recompute differently than the page, or the email and the app will disagree).

## Content (real data only — never invent a number; if a section has nothing, omit it)
- **The Number:** Workforce Performance Score + the change vs last week (▲/▼). This is the emotional center — lead with it.
- **What your team did this week:** tasks completed, leads researched, drafts approved/sent, warm leads (once the wedge ships). Concrete counts, in plain language.
- **What needs you:** pending approvals, leads with an overdue Lead-Lifeline `next_action`, anything in a `needs-owner` state. Make these one-click into the app (deep links).
- **What's planned:** the top open tasks/next actions for the coming week.
- **One Atlas line:** a single calm, human sign-off in Atlas's voice (one challenge or focus for the week), not a wall of text.

## Mechanics
- **Schedule:** Monday ~08:00 in the owner's timezone (store/default sensibly). Add a weekly branch to the existing cron — only fire the weekly email when it's Monday in that company's tz; keep the daily drip as-is.
- **Per-company:** send to the owner's account email. Skip companies that aren't onboarded or had zero activity (or send a gentle "quiet week — here's one move" nudge rather than an empty report — owner comms should never feel broken; CEO.md empty-state law).
- **Idempotency:** record the weekly send (e.g. a `briefing_sends` row or ledger-style key `YYYY-WW`) so a cron retry never double-sends.
- **Not metered:** this is owner communication, not AI work — do not debit hours. `is_internal` (Mitri) still receives it.
- **Footer/compliance:** this is transactional owner comms, not marketing outreach — but keep it clean and include an in-app notification-settings pointer.
- **Design:** matches the product (light theme, typography hierarchy, the Number prominent). Mobile-readable email HTML.

## Definition of done
`build` / `lint` / `tsc` green. Ship `scripts/verify-weekly-briefing.mjs` proving: the week-key idempotency blocks a double-send; the "quiet week" path triggers when there's no activity; the score-delta math is correct; a zero-data/not-onboarded company is skipped. (DB firewalled from Cowork — include "run it + report results" in handoff.) List any pending migrations. Commit + push, log to `CHANGELOG.md`. Acceptance test (Mitri): receive a real weekly email that makes you want to open the app.
