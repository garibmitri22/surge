# Surge — Build Order (what's left, sequenced from the best build perspective)

Compiled June 6. The ordering principle: **finish & prove what just shipped before building anything new; prove it on a real customer before building the expensive/future stuff; never charge until polished.** (Per `NORTH-STAR.md` + the "proof before more building" call.)

## ✅ Already shipped today (don't rebuild — verify only)
Orb (PresenceOrb, structure+ring), the Wedge (warm-signal lead loop), Weekly CEO Briefing email, Nova's Studio, Inbound speed-to-lead, Dashboard credibility fixes, Database reactivation, Hire/Department experience, active-advertiser segment, vertical packs + med-spa pack #2, BOTH landing desktop fixes, outcomes-first dashboard, day-one activation. Most shipped with a `scripts/verify-*.mjs`.

---

## PHASE 1 — Finish & verify what shipped (do this BEFORE anything new)
A build isn't done until its migration runs and it's seen working.
1. **Run all pending Supabase migrations** (dev lists them per handoff; e.g. hours_reset, internal_flag, inbound, reactivation, hiring, content). A shipped migration that hasn't run = broken feature.
2. **Apply `internal_flag` to Mitri's company** → fixes the "198/70h" to "Unlimited" (the credibility fix needs the migration actually applied to the row).
3. **Mitri visual QA pass** — confirm the landing desktop now looks right (shifted-left bug just fixed), and the outcomes-first dashboard + day-one activation feel right on desktop + phone.
4. **Run the verify scripts / prod verify suite** against surgehq.io while Confirm-email is OFF.
5. **Flip Confirm-email ON** in Supabase once verify is green (then the send-freeze on the drafts lifts).

## PHASE 2 — Prove it (dogfood + first real customer) — the gate to everything future
6. **Dogfood:** Mitri runs Aria on Surge's OWN pipeline ("target home-services contractors in Houston") → real, well-scored leads + drafts. If good, engine proven; if not, that's the bug to fix before any customer.
7. **Mitri: Twilio account + 10DLC registration** (a few days; gates all SMS — reactivation/inbound texting).
8. **Land the first managed contractor** → point Aria at their existing list (reactivation) → first real outcome ("rebooked 3 jobs"). Collect payment **manually** (no Stripe needed). → This is the investor-grade proof (`POC-INVESTOR-PLAN.md`).

## PHASE 3 — Polish/feel + revenue plumbing (after proof)
9. **Voices (ElevenLabs)** — `prompts/voices-kickoff-prompt.md`. Needs Mitri's API key + 4 voice picks. Pure feel/polish.
10. **Orb premium finish** — distinct per-agent MOTION signatures + audio-reactive on real voice (base shipped; finish the "feels alive" layer). `prompts/orb-kickoff-prompt.md` (REFINEMENT section).
11. **"Target a market" feature** — `prompts/target-a-market-prompt.md`. Extends Aria; high value once core is proven.
12. **Stripe billing — DEFERRED until polished**, then build in **test mode**. `prompts/stripe-billing-prompt.md`.
13. **Legal gate (HARD GATE before charging anyone)** — `legal/legal-readiness-and-gaps.md`: indemnification clause, controller/processor + DPA, full subprocessor list, name the entity. Mitri: attorney review + form/confirm entity + create support@/privacy@ aliases.

## PHASE 4 — The future (gated on Phase 2 proof + keys; specs prepped)
14. **Level-4 heartbeat (24/7 autonomy)** — `prompts/level4-heartbeat-prompt.md`. Gated on: proof + `CRON_SECRET` + `SUPABASE_SERVICE_ROLE_KEY` in Vercel + per-employee autonomy flip. Safe phasing: research/drafts run 24/7; sends stay approval-gated.
15. **Nova-ads closed loop** — `prompts/nova-ads-closed-loop-prompt.md`. Phase 2a (Nova hands owner a launch-ready ad — low risk) first; 2b (Nova manages live spend, hard money guardrails) only after 2a + proof.

---

## 🧑‍💼 Mitri's desk (only you — run in parallel, several gate the phases above)
- ElevenLabs API key + pick 4 voices (gates #9).
- Twilio account + 10DLC registration (gates SMS, #7).
- Stripe account + product/price IDs (gates #12, after polish).
- Attorney review + legal entity + support@/privacy@ aliases (gates charging, #13).
- `CRON_SECRET` + `SUPABASE_SERVICE_ROLE_KEY` in Vercel (gates #14).
- Form 1583 notarization (mailbox); Sentry DSN (error alerts).
- The dogfood run (#6) + the first customer conversations (#8).

## ⏸️ Parked / decided (not now)
- Payments live = after polish (collect manually meanwhile).
- Lead warehouse / reselling leads = killed (legal + anti-moat).
- Native iOS/Android app = after customer #1 (PWA covers now).
- ICP reconciliation, task dedupe, full mobile pass = minor, after proof.
