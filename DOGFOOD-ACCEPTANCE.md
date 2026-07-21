# Dogfood Acceptance Rubric — is Aria good enough to show a customer?

The Phase-2 gate. Run this in Surge yourself before any real customer sees it. If it passes, the engine is proven and you're ready to point it at a contractor's list + demo. If it fails, that's the exact bug to fix first — same engine the customer would use.

## The run
In Surge (you're customer #1), have Aria target a real market: **"Find home-services contractors in Houston"** (roofing/HVAC/flooring). Let her research, score, and draft. Approve nothing yet.

## Pass criteria (objective — all must be true)
**Leads**
- [ ] Returns a real batch (target 20+), not a token few.
- [ ] Each is a REAL business — spot-check 3–5 by Googling the name + website. Zero fabricated/hallucinated businesses. (One fake = hard fail; it's the credibility killer.)
- [ ] All in the right vertical AND geography (Houston-area home services, not random).

**Scoring**
- [ ] Each lead has a 0–100 score with all four reasons (ICP fit / pain / ability / reachability) + a real source URL.
- [ ] Scores actually discriminate — a spread, not everything 85–90. The top 5 genuinely look like the best fits.

**Drafts**
- [ ] Outreach is specific to each lead (references something real about them), not a generic template.
- [ ] Uses a real angle (the post-click leak / speed-to-lead), has the booking CTA/link.
- [ ] Reads like a person wrote it. Nothing was sent (pending approval).

**Economics & honesty**
- [ ] Run cost is sane (~$0.33–2) and hours debited correctly (or Unlimited for your internal account).
- [ ] Dashboard shows real counts; pipeline $ only appears if you've set avg deal value; no fake numbers.

## Decision
- **All checked → PASS.** Engine proven. Move to Phase 2: point Aria at a real contractor's existing list (reactivation) for the first outcome, and you're demo-ready.
- **Any unchecked → FIX FIRST** (feed to dev): thin/fabricated leads → research prompt + sources; flat scores → scoring rubric; generic drafts → brand-voice/prompt. Do NOT show a customer until it passes — they'd hit the same flaw.

## Why this matters
This run IS the proof. A skeptic believes "Aria found these real businesses while I slept" only if they're real and well-scored. Passing this rubric is the difference between a convincing demo and "is this real?" doubt.
