# Build: Ops now — owner-unlimited account + error alerting (small, high-leverage)

Read CLAUDE.md, MEMORY.md, CEO.md first. Two small ops items Mitri wants now (from friends-launch). Both are quick and protect the business as real users arrive.

## 1. Owner / internal unlimited account flag
Mitri needs his own account exempt from metering + plan gating, to grow/demo/dogfood without hitting walls.
- Add `is_internal boolean not null default false` to `companies` (migration). Set true for Mitri's Surge company (the one with company_name = 'Surge' / user garibmitri1@gmail.com).
- In the hours gate (`lib/hours.mjs` gateWork/debitHours) and any entitlement checks: if the company is_internal → bypass hours limits AND any plan/employee gating entirely (unlimited).
- Keep it server-enforced (don't trust client). Add a verify check: internal company runs never blocked by hours; non-internal still gated.
- This is also the basis for future staff accounts.

## 2. Error alerting — get paged when prod breaks
Mitri's concern: a friend hit a bug and nobody was notified; it "sat in queue." Atlas is the CUSTOMER's agent, NOT a platform monitor — the right tool is error monitoring.
- Wire **Sentry** (or Vercel's built-in log drains / a simple catch-all) for the Next.js app: capture server + client exceptions in production.
- Configure alerting so a production exception → emails Mitri (garibmitri1@gmail.com) + the dev, and SMS/phone if easy (Sentry supports alert rules → email always, SMS via integration).
- Sentry DSN goes in Vercel env (NEXT_PUBLIC_SENTRY_DSN / SENTRY_AUTH_TOKEN) — Mitri pastes, never in chat/repo.
- Don't over-instrument; default Next.js Sentry SDK setup is enough. Scrub PII per their config.
- Verify: throw a test error in prod → confirm the alert fires to email.

## Out of scope
- Full admin/ops console + customer impersonation = separate later project (after first customer, with legal docs). NOT now.
- Plan selection / entitlement enforcement UI = ships with Stripe. NOT now (just make is_internal bypass work).

## Definition of done
build/lint/tsc green, migration applied, is_internal bypass verified, Sentry firing test alert to email, committed + pushed.
