# Kickoff: "Target a market" — on-demand (and always-on) prospecting

First read `NORTH-STAR.md`, `MEMORY.md` ("B2B vs B2C MOTIONS", "NO LEAD WAREHOUSE", maturity ladder). Goal: the owner names a market and Aria starts pulling + scoring leads there, then markets to them (approval-gated), optionally running continuously. Mostly extends Aria's EXISTING research engine into a first-class control + ties to the Level-4 heartbeat — don't rebuild the agent.

## What to build
1. **"Target a market" input** (a clean action on `/leads` or the dashboard): owner specifies market = vertical + geography (+ optional ICP refinements). Examples: "HVAC companies in Dallas," "marketing agencies in Austin."
2. **Aria researches on command:** kick the existing research→score(0–100 + reasons + source)→draft engine scoped to that market. Results land in `leads`, tagged with the market/campaign so segments stay distinct.
3. **Market to them (approval-gated):** Aria drafts outreach in brand voice; owner approves; send via the existing email path (warmup-paced, suppression, CAN-SPAM footer). Tracked link → warm → owner ping (reuse the wedge).
4. **Optional always-on:** "Keep this market running" → registers it with the Level-4 heartbeat so Aria keeps adding fresh scored leads for that market on a schedule, hours-budgeted. Each market = its own running segment.

## HARD GUARDRAILS (non-negotiable)
- **Cold targeting = B2B only.** This feature cold-prospects *businesses* (owners), which is legal via web research + CAN-SPAM email. If the named market is CONSUMERS (homeowners, individuals), DO NOT cold-mine-and-market — detect it and route the owner to the right motion instead: "That's a consumer market — we win those with ads (Nova) + speed-to-lead + reactivation, not cold outreach." Never cold-text/call mined consumers (TCPA).
- **Not a warehouse.** Leads fill the owner's working pipeline — exclusive, worked, with a next action (Lead Lifeline). Never an inventory to resell or share across customers.
- **Real data only** — researched real businesses with sources; never seeded/mock.
- **Metered + budgeted:** runs debit hours via `lib/hours.mjs`; always-on respects the hours budget so it can't run away; `is_internal` bypass.
- Outward sends stay approval-gated until the owner flips the employee autonomous (per the Level-4 design).

## Definition of done
`build`/`lint`/`tsc` green. Owner can name a B2B market and get real scored leads + drafts for it; a consumer market is detected and redirected (not cold-marketed); "keep running" schedules continued prospecting within the hours budget; everything approval-gated; segments tagged by market. Ship `scripts/verify-target-market.mjs` (B2B market → leads; consumer market → blocked/redirected, never auto-outreach; hours budget caps the always-on run). Commit + push, log to `CHANGELOG.md`. Acceptance (Mitri): type a B2B market, watch Aria return real scored leads + drafts for it; type a consumer market, get routed to ads/reactivation instead.
