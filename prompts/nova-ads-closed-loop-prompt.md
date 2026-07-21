# Kickoff: Nova runs the ads → the closed-loop growth engine (FUTURE — Phase 2)

First read `NORTH-STAR.md`, `CEO.md`, `MEMORY.md` ("SCALING TO $1M" lever #1), and `SCALING-ROADMAP.md`. This is the flagship: ad spend in → booked appointments out, run by the AI team. **Sequencing is a hard rule: do NOT build this until Aria's existing half (research→outreach→warm→book + reactivation) is PROVEN on a real customer.** Building the expensive, risky top of the funnel before the bottom is proven is backwards. This spec is "prepped for the future," not "build now."

## The full loop
Nova researches the market & what competitors advertise → Nova creates ad creative → ads run on Meta/Google → leads captured (the inbound seam already exists: `app/api/inbound/meta`, `/google`, form, sms) → Aria nurtures + books → owner closes → results feed the Workforce Score + weekly briefing. Then it optimizes and repeats.

## Phase it internally (because live ad spend is the highest-risk thing in the product)
**Phase 2a — Nova as ad strategist (LOW risk, build first):**
- Nova researches the vertical/market and (via the public Meta Ad Library / Google Transparency Center, read-only) what's being advertised, to inform angles. Pulls brand voice + offer from `memory_entries`.
- Nova produces ready-to-run **ad creative + copy + a recommended campaign plan** (audience, budget, objective) that the **owner launches manually**. No autonomous spend, no API write access. This captures ~80% of the value at near-zero risk, and connects straight into the existing inbound capture → Aria.

**Phase 2b — Nova manages live campaigns (HIGH risk, only after 2a + real proof):**
- Write access to Meta/Google Ads APIs to launch + adjust campaigns and read performance, then optimize.
- **Money guardrails are non-negotiable:** hard owner-set spend caps; the owner approves budget and any increase; Nova can NEVER raise spend beyond the cap or without approval; full, transparent spend + result reporting; fail-closed (pause, don't overspend, on any error). Treat real ad dollars like the consent rule — a bright line.
- Honesty: report only measurable results; never claim conversion lift you can't attribute.

## Connect the loop
- Nova's leads flow through the EXISTING inbound endpoints into `leads` (tag origin so ad-sourced leads are distinct) → Aria's speed-to-lead + nurture + warm-signal + booking take over → owner closes. One pipeline, two employees, a visible hand-off in the activity feed (Architecture Law #3).
- Feed ad-sourced outcomes into the Workforce Score + weekly briefing as real results (with the honest pipeline estimate = qualified × avg deal value).

## Metering & architecture
Meter Nova's work (research/creative) in hours via `lib/hours.mjs`; ad SPEND is the customer's own budget, separate and never metered as our hours. `is_internal` bypass for our own use. Keep it data-driven so it works per vertical (vertical packs).

## Definition of done (Phase 2a)
`build`/`lint`/`tsc` green. Nova produces real, on-brand ad creative + a campaign plan the owner can launch; the resulting leads (when the owner runs the ads) flow through inbound → Aria with a clear hand-off; no autonomous spend anywhere. Ship `scripts/verify-nova-ads.mjs`. Commit + push, log to `CHANGELOG.md`. (Phase 2b spec'd separately, gated on 2a + first-customer proof.) Acceptance (Mitri): Nova hands you a launch-ready ad + plan in your brand voice, and when leads come in, Aria picks them up automatically.
