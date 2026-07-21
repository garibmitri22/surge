# Kickoff: Outcomes-first pass — show the money (honestly), demote the plumbing

First read `CEO.md` (the One Number; the moat = memory) and `MEMORY.md` (credibility pass — "every number correct or gone"). Context: 2nd buyer review, 8.3/10 (up from 5). Strengths confirmed and DON'T touch: activity feed, leads page, reactivation, Memory/Company Profile, Nova Studio, Team section, "Needs your attention." The one recurring gap across every weak spot: the product shows ACTIVITY/agents, the buyer wants OUTCOMES/results/money. This pass flips that. It's the conversion + price-justification unlock.

## HONESTY RULE (non-negotiable — this is the credibility line)
Every number is real or a transparently-computed estimate. **NO invented/hardcoded dollar figures.** The only money figure allowed is **Estimated Potential Pipeline = (qualified + warm leads) × the customer's own average deal value**, shown labeled "Estimated" with the formula visible (hover/tap: "3 qualified × $15,000 avg job"). If average deal value isn't set, DON'T show a dollar number — show the real counts only and prompt the owner to set it. A wrong/fake money number is worse than no money number.

## 1. Capture average deal value (powers honest money math)
Add "Average deal / job value" to onboarding + the Company Profile (a `memory_entries` field). Per-customer, editable. This is what makes the pipeline figure real and personal (roofer $15k vs gym membership $600).

## 2. Results-first dashboard hero — replace "3 Online" with "Team Generated"
At the very top of the dashboard, a prominent "This Week" / "Team Generated" card showing REAL counts already computed (`lib/data.ts` stats): Leads Found · Qualified · Outreach Sent · Meetings Booked. Plus **Estimated Potential Pipeline $** (per the honesty rule). This is the hero — above the agent roster. Replace the "3 Online" presence indicator entirely with this results summary. Keep the verifiable activity feed (it's the trust-builder) right below.

## 3. Compact the Atlas card
The Atlas briefing card currently eats ~half the screen. Shrink it to a tight "Today's Results" summary (the same real counts) with the full morning briefing collapsed/secondary (expandable). Keep the orb. Atlas should headline results, not a wall of prose.

## 4. Tasks page — compress (currently 6.5/10)
Rows are giant walls of text ("Write cold email sequence (3-4 touches) for real estate teams and brokerages…"). Show a short, human title (e.g., "Real estate follow-up campaign") with the full detail behind a tap-to-expand. Derive/generate the short title from the task. Make it read like polished SaaS, not a database dump.

## 5. Weekly CEO Briefing email — lead with outcomes
Update the briefing email (`prompts/weekly-briefing-email-prompt.md`) to lead with the outcome counts + estimated pipeline, not the Score. "Score 39 / 1 task done" reads as "so what"; "8 qualified leads · 2 meetings booked · ~$X potential pipeline" reads as money.

## Positioning thread (carry through copy)
Memory/Company Brain is the moat (the reviewer independently called it that). Where natural, frame the pitch as "AI employees that remember your business." Don't rebuild anything — just lean copy toward the memory/outcome story.

## Definition of done
`build`/`lint`/`tsc` green. Ship `scripts/verify-outcomes.mjs` proving: potential-pipeline = qualified×avgDealValue and is ZERO/HIDDEN when avg deal value is unset (never fabricated); the dashboard hero pulls real counts from the same source as the rest of the app (no divergence); no hardcoded dollar figures anywhere. Counts must match the activity feed/leads reality. Commit + push, log to `CHANGELOG.md`. Acceptance (Mitri): open the dashboard and the FIRST thing you see is real results + an honest pipeline estimate — not agent names — and every number is defensible.
