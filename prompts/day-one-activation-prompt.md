# Kickoff: Day-one activation — the team works BEFORE the user has to do anything

First read `NORTH-STAR.md`, `CEO.md` (Failure #1 "just ChatGPT", #2 day-14 cliff, #5 overpromise), and `MEMORY.md`. Problem (from demos): users didn't know what to do — the empty-app "now what?" that kills activation. Skeptics want results, not a floating orb. Fix: the moment onboarding ends, the agents have ALREADY done real work and present it. Show, don't explain. Near-zero time-to-first-result.

## The flow
1. **Onboarding feeds the agents (mostly exists — Atlas intake).** Capture ICP, offer, vertical (→ vertical-pack prefill), average deal value, and — high value — let them **upload their existing customer/quote list**. That's enough for Aria to act immediately.
2. **On onboarding complete, auto-kick Aria's first run (server-side, no user action):** research + score the first real batch of leads for their ICP, and draft outreach. If a list was uploaded, also queue a **reactivation** batch (the fastest real day-one win). Consider comping this first run so the "wow" is guaranteed (never charge for the activation moment).
3. **First dashboard = "Your team already went to work" — never an empty app or a hero orb.** Show real results: leads found (real names + sources), drafts ready, reactivation queued — with ONE obvious next action: "Review & approve Aria's first 3 emails." A guided first win, not a tour.
4. **Approval-gated + honest.** Nothing sends without the owner's approval and sending readiness (reply-to / consent / 10DLC where relevant). So "day one" = real work done + pipeline + queued outreach, ready to approve — verifiable, but NO autonomous unsupervised sending, and NO claim of "closed deals day one." Pipeline/activity are real; conversions show as they actually happen over the following days.
5. **Guided first-run state** that walks them to: approve → first send → then gets out of the way. After the first win, fall back to the normal outcomes-first dashboard.

## Guardrails (non-negotiable)
- Real data only — researched real businesses, the user's real uploaded list. NEVER seed mock/demo leads to fake the moment (that relights the "is this real?" problem the credibility pass fixed).
- Don't overpromise: frame as "your team is working — here's your pipeline," not day-one revenue. Honesty is the anti-skeptic move.
- Results are the hero; the orb/agent visuals are supporting cast (per NORTH-STAR: outcomes over activity).

## Definition of done
`build`/`lint`/`tsc` green. A brand-new user, immediately after onboarding, lands on a dashboard already populated with REAL researched leads + drafts (not empty, not mock), reactivation queued if a list was uploaded, and a single clear first action — with nothing sent without approval. Ship `scripts/verify-activation.mjs` proving: onboarding-complete triggers a real Aria run; the first-run output is real (not seeded mock); no send occurs without approval; first run isn't charged. Commit + push, log to `CHANGELOG.md`. Acceptance (Mitri): onboard a fresh test company and the first screen shows your team already did real work — a skeptic would believe it.
