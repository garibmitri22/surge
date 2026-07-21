# Kickoff: The Wedge — Lead-gen loop (deeper research + warm-signal + owner ping)

First read `CLAUDE.md`, `MEMORY.md` (see "🚀 PRODUCT DIRECTION" + "WARM-SIGNAL ARCHITECTURE"), and `CEO.md`. This is the revenue path: "AI that fills your pipeline with qualified, ranked leads," then proves engagement. Build on the EXISTING engine — do not rebuild.

Current state to extend (verified): `app/api/agent/run/route.ts` (Aria's tool-loop with `web_search` + `create_lead`), `leads` + `lead_drafts` tables (`supabase/leads_migration.sql`), `lib/leads.ts`, approve→send via `deliverDraft` (`lib/email.mjs`) + `app/api/leads/approve`, warmup drip in `app/api/cron/heartbeat`, `/leads` CRM page. Reply-to is the CUSTOMER's own inbox — Surge never ingests per-tenant mail; that stays true.

## The loop to deliver
Research a big scored pipeline → draft with ONE tracked CTA link per lead → owner approves → paced sends (warmup) → prospect clicks / books → lead auto-promotes to **warm** → owner notified. The warm signal is an ACTION (a click/booking), never us reading their replies.

## 1. Deeper research (scale the pipeline, not the sends)
- Tune Aria's run so one run yields **30–50+ real scored leads** (today ~7). Raise the loop ceiling (`MAX_ITERATIONS`) as needed and adjust the run prompt to keep researching/scoring until the target or the search is genuinely exhausted — never invent leads to hit a number. Keep the 0–100 rubric with all four `score_reasons` + `source_url`.
- Keep the two numbers separate everywhere: **leads researched** (scales freely) vs **emails sent** (hard-capped by warmup + CAN-SPAM). Deliverable = big ranked pipeline + paced outreach.
- Metering unchanged: the run is gated/debited via `lib/hours.mjs` (`is_internal` bypass). Never charge for a thin/failed run.

## 2. Tracked CTA link (the warm signal)
- New migration (e.g. `supabase/warm_signal_migration.sql`): add `warm` to the `leads.status` check constraint; add `leads.first_clicked_at timestamptz`, `leads.click_count int default 0`, `leads.booked_at timestamptz`; add `companies.booking_url text` (nullable). RLS consistent with existing tables. **List the migration in your handoff so Cowork runs it.**
- New redirect route `app/api/r/[token]` (mirror the `app/api/unsubscribe` pattern): `token` = HMAC-signed `{ leadId, companyId }` (sign with an existing server secret; do NOT put raw IDs in the URL). On hit: increment `click_count`, set `first_clicked_at` if null, promote `new/qualified/drafted/contacted → warm` (never downgrade `replied/meeting`), update the Lead Lifeline `next_action`/`next_action_at` to a follow-up, log an activity row, fire the owner notification (below), then 302 to the destination.
- Destination resolution: `companies.booking_url` if set (e.g. the customer's Calendly); else a Surge-hosted per-tenant interest page `app/book/[token]` (simple "request a call" page that captures name/email/time-preference and on submit sets `booked_at` + status `meeting`). v1 default = the hosted interest page so there's zero external dependency; Calendly is opt-in via settings.
- Every approved outbound draft embeds exactly ONE such tracked link as its CTA. Update draft generation + `deliverDraft` so the link is per-lead and signed.

## 3. Owner notification (the magic moment)
- On click → warm: notify the owner via in-app activity feed AND an email ("Aria: [Lead] just clicked your link — they're warm"). On booking → meeting: stronger notification. This is the "my AI team sent me this" moment (CEO.md lever 3) — make the copy feel like a real teammate flagging a live opportunity, in Aria's voice.
- Keep it honest: only fire on real events; no digests of non-events.

## 4. Surfaces
- `/leads` CRM: show `warm`/`meeting` prominently (sort warm to top), show click count + last-clicked, and the engagement state on each lead. Empty + zero states intentional (CEO.md Three Gaps).
- Feed engagement into the existing Workforce Performance Score pipeline input where it fits (a warm lead is stronger pipeline signal than a raw qualified one) — reuse `lib/score.mjs`, don't fork it.

## Definition of done
`build` / `lint` / `tsc` green. Ship `scripts/verify-wedge.mjs` proving: token sign/verify round-trips and rejects tampering; a simulated click promotes to `warm`, increments count, sets `next_action`, and is idempotent on repeat clicks; a booking sets `meeting` + `booked_at`; status never downgrades. (Per the Verify-It-Yourself rule, include "run it + report results" in your handoff, since the DB is firewalled from Cowork.) List any pending migrations. Commit + push, log to `CHANGELOG.md`. Acceptance test (Mitri): one run produces a deep ranked pipeline; approving + a simulated prospect click flips the lead to warm and pings the owner.
