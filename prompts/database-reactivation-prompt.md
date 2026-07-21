# Kickoff: Database reactivation (wake up the owner's existing list — fastest legal revenue)

First read `MEMORY.md` ("B2B vs B2C MOTIONS", "SCALING TO $1M") and `CEO.md`. This is the lead demo for the Managed Growth Engine (`offers/managed-growth-engine-home-services.md`) and the single fastest, lowest-risk "wow": point Aria at a business's OWN existing customers and unclosed quotes and rebook them. No ad spend, no cold prospecting — revenue out of contacts they already have a relationship with.

Build on the existing engine — reuse `leads`, `lead_messages` (from the inbound spec), the conversation brain, `deliverDraft`/email, Twilio, the tracked-link/warm-signal (`prompts/wedge-leadgen-loop-prompt.md`), and `lib/hours.mjs`. Do NOT rebuild any of it.

## Consent reality (the spine — do not skip)
These are the owner's existing contacts, but TCPA/CAN-SPAM still apply by channel:
- **Email** is the default reactivation channel: an established business relationship + CAN-SPAM compliance (accurate sender, physical address, working unsubscribe — already built) makes emailing past customers low-risk. Lead with email.
- **SMS/voice** to these contacts is ONLY allowed where there's a consent record (and 10DLC registered). Gate per-contact: no consent → email only, never auto-text/call. `is_internal` does NOT bypass consent.
Store the consent basis on every imported contact; the system must refuse a channel it has no basis for.

## 1. Import the list
- CSV upload (and/or paste) on a new Reactivation surface: name, email, phone, last-visit/last-quote date, amount, status, and a consent column. Map columns, validate, dedupe against existing `leads`.
- Create rows as `leads` with `origin='reactivation'` (extend the origin enum from the inbound migration), stamping source, the consent basis per channel, and the relationship facts (last seen, past spend, what they bought/quoted). New migration if columns are missing — list it in handoff for Cowork to run.

## 2. Aria segments + drafts
- Aria segments the list: lapsed customers, old/unclosed quotes, past buyers due for repeat. Reuse the agent brain; pull brand voice + offer from `memory_entries` so the message sounds like the business.
- Generate personalized reactivation outreach per segment ("Hi [name] — it's been a while since your [service]; here's [offer]"), each with ONE tracked CTA link (reuse the wedge's signed `/api/r/[token]` → click promotes to `warm` → owner pinged). Owner approves before anything sends (approval mode).

## 3. Paced, channel-correct send
- Email: send via the existing warmup-paced drip (`heartbeat`) + suppression + unsubscribe.
- SMS (consented contacts only, 10DLC gated): Aria texts via Twilio; two-way replies flow through `lead_messages` / `app/api/inbound/sms`; honor STOP.
- Responses → conversation → booking → status `meeting`; owner notified (feed + email) on every warm/booked — that's the demo payoff.
- Meter the campaign as work via `lib/hours.mjs`; never charge for failed sends.

## 4. Surface (the demo screen)
- A Reactivation view (own page or a tab on `/leads`): upload, segment counts, campaign status, and a clear **results headline — "X rebooked, Y replied, Z appointments"** from real data. Empty/zero states intentional. This is what you show a roofer/gym owner to close them.

## Definition of done
`build`/`lint`/`tsc` green. Ship `scripts/verify-reactivation.mjs` proving: a contact with no SMS consent can never be auto-texted (email-only), CSV import creates `origin='reactivation'` leads with consent + relationship fields, a tracked click promotes to warm + pings owner, dedupe against existing leads works, metering debits once and never on failure. (DB firewalled from Cowork — include "run it + report results" in handoff.) List pending migrations. Commit + push, log to `CHANGELOG.md`. Acceptance (Mitri): upload a real past-customer list (e.g. the gym friend's lapsed members), approve a batch, and watch real replies/rebookings come back with owner pings.
