# Kickoff: Inbound capture + speed-to-lead (Phase 1 — the B2C / residential motion)

First read `CLAUDE.md`, `MEMORY.md` (see "B2B vs B2C MOTIONS" + "WARM-SIGNAL ARCHITECTURE"), and `CEO.md`. This is the SECOND motion: residential/consumer customers (gyms, realtors, roofers, flooring) can NOT be cold-prospected — they win by answering inbound instantly and working their consented database. This task builds the inbound + instant-response half. Cold outbound (Aria's research+email) stays as-is for B2B; do not touch it.

**Consent is the spine of this whole feature.** We never text or call anyone without a stored consent record. This is TCPA — statutory damages are $500–$1,500 per message with no cap. Build consent-first or don't build it.

## The flow
Ad (Google/Meta) → lead reaches Surge via one of three adapters → normalized into ONE endpoint → lead created with consent + source stamped → Aria responds within seconds (text) → two-way conversation → owner can one-tap bridge to a live call → owner notified throughout.

## 1. Schema (new migration `supabase/inbound_migration.sql` — list it in handoff so Cowork runs it)
- Extend `leads` (don't fork): add `origin text default 'researched'` (`researched` = Aria's cold B2B research; `inbound` = this motion — keep them visually + logically distinct), `phone text`, `consent_text text`, `consent_at timestamptz`, `consent_ip text`, `consent_channels text[]` (e.g. `{sms,call,email}`), `source text` (e.g. `surge_form|meta_lead_ads|google_lead_form|click_to_call`). Add `inbound` and `engaged` to the `status` check constraint.
- `lead_messages` table: `id, company_id, lead_id, direction (inbound|outbound), channel (sms|email|call), body, twilio_sid, created_at` — the conversation log.
- `companies`: add `twilio_number text`, `twilio_messaging_service_sid text`, `owner_phone text`, `tendlc_status text default 'none'` (gate sending until registered).
- RLS consistent with `leads`. **No consent record → the system must refuse to send. Enforce server-side.**

## 2. Normalized inbound endpoint `app/api/inbound/lead`
- One handler all adapters feed. Creates the lead (`origin='inbound'`, `status='inbound'`), stores name/phone/email + the consent fields + source, then triggers the speed-to-lead response (below).
- **Adapter A — Surge-hosted form (BUILD THIS FIRST):** a simple per-tenant capture page/form that POSTs here. The form carries the explicit TCPA consent checkbox + disclosure language; we store the exact wording, timestamp, and IP. This is the path where WE own consent — anchor on it.
- **Adapters B/C — Meta Lead Ads webhook + Google Lead Form webhook (scaffold + document, wire later):** stub the routes with the verification handshake and a TODO; these need per-customer app/webhook setup in onboarding. Don't block Phase 1 on them.
- Secure the endpoint per-company (signed token / source key in the URL or header), not open to the world. Validate source.

## 3. Speed-to-lead response (Aria, instant)
- On a consented inbound lead, **within seconds** Aria sends the first SMS from the company's Twilio number (Twilio Programmable Messaging). Two-way: inbound replies hit `app/api/inbound/sms` (Twilio webhook) → Aria reads the thread, the LLM (reuse the agent/chat brain) writes the next line in the company's brand voice → reply. Log every message to `lead_messages`.
- Honor STOP/opt-out automatically (Twilio + our suppression). Respect quiet hours.
- SLA + cadence: track time-to-first-touch; if the lead goes cold, paced follow-ups (mirror the Lead Lifeline `next_action`/`next_action_at` pattern). Promote `inbound → engaged` on reply.
- **Gate on `tendlc_status`:** if not registered, queue + surface "finish SMS setup" rather than sending illegally. `is_internal` does NOT bypass consent or 10DLC (legal, not billing).
- Metering: a live lead conversation is WORK (debit hours per the model, `lib/hours.mjs`); owner↔Aria chat stays unlimited. Never charge for a failed send.

## 4. Owner-bridge call (the pragmatic "we call them")
- `app/api/voice/connect`: Twilio Programmable Voice calls the owner (`owner_phone`), and on answer bridges them to the lead's number — "press 1 to connect to your new lead now." No AI voice speaks to the consumer in Phase 1. Log the call to `lead_messages` (channel `call`).
- One-tap "Call now" on the lead in the UI.

## 5. Surfaces
- `/leads`: inbound leads sorted by freshness (newest/un-responded to the top), clearly tagged `inbound` vs `researched`, show consent + channels, time-to-first-touch, and the live conversation thread. One-tap Call. Empty/zero states intentional (CEO.md Three Gaps).
- Speed-to-lead metric feeds the Workforce Performance Score where it fits (reuse `lib/score.mjs`).

## Mitri's manual steps (only he can)
Create the Twilio account; complete **10DLC brand + campaign registration** (TCPA/carrier requirement — a few days, gating); provision number(s); paste `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, messaging service SID, number into `.env.local` + Vercel. Per-customer Meta/Google ad connections come later in onboarding.

## Phase 3 (DOCUMENT ONLY — do not build now)
True AI voice calls (Aria actually speaks on the phone): Twilio Programmable Voice **media streams** → speech-to-text in → LLM → ElevenLabs TTS out, sub-second latency, with a mandatory AI-disclosure at call start. Separate stack from the in-app ElevenLabs voice (telephony audio, not browser). Write a short `Phase 3 notes` section in the code/README; build after Phase 1 proves out.

## Definition of done
`build`/`lint`/`tsc` green; no-ops cleanly when Twilio keys/10DLC are unset (queue + surface setup, never send). Ship `scripts/verify-inbound.mjs` proving: a lead with NO consent record can never trigger a send (hard block); the normalized endpoint creates an `inbound` lead with consent + source stamped; an inbound SMS reply logs + advances the thread; STOP opts out + suppresses; `tendlc_status!='registered'` blocks sending; metering debits a conversation once and never on failure. Include "run it + report results" in handoff. List pending migrations. Commit + push, log to `CHANGELOG.md`. Acceptance (Mitri): submit the hosted form as a fake lead → get an instant Aria text back → reply → Aria holds the conversation → one-tap bridges a call to your phone.
