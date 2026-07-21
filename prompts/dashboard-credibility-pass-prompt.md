# Kickoff: Dashboard credibility + outcome reframe (the conversion fix)

First read `CEO.md` (the One Number; "real beats simulated") and `MEMORY.md`. Context: an external reviewer + CEO review of live screenshots. The concept sells; **conversion-to-paid is the gap**, for two reasons — (1) the dashboard screams *agent activity*, not *business results*, and (2) several numbers are visibly broken, which makes a skeptical owner distrust everything. **Governing rule for this whole task: every number on the dashboard is either correct or gone.** Do NOT add invented dollar/ROI figures — we have a credibility-of-numbers problem already; lead with verifiable counts, not estimates.

## A. Trust-breaking bugs (fix first — exact locations)
1. **"198h of 70h team time left" (`components/HoursWidget.tsx`).** Renders `{balance} of {allowance}` with no guard, so balance > allowance prints nonsense. Three root fixes:
   - **Owner/internal account shows a number instead of "Unlimited":** the owner's company `is_internal` isn't set. Apply/verify `supabase/internal_flag_migration.sql` and confirm the owner company row is flagged (getHoursSummary already returns `unlimited` from `is_internal`). **List this migration in your handoff so Cowork runs it.**
   - **Allowance is stacking past the cap (no-rollover not enforced):** the monthly grant must RESET balance to the plan allowance, not add another 70 on top each period. Fix the grant logic so a non-internal balance can never exceed allowance + purchased overtime.
   - **Display guard:** never render "{balance} of {allowance}" when balance > allowance. Clamp/relabel (e.g., show just the balance, or "Full").
2. **Red failing "39" as the hero (`app/dashboard/page.tsx` `ScoreRing`, color `< 50 = #ef4444`).** Showing a big red failing grade labeled "Live, from your team's real work" tells the owner the product is doing badly. Reframe (next section) — demote the score, recalibrate so early real usage isn't an "F," and frame it as "Building" not failing.
3. **"Garibmitri1" username leak (`lib/data.ts` `getUserDisplay`, line ~302 splits the email local part).** When no real name is set it manufactures a name from the email handle. Fix: prefer a real profile name; if only an email handle exists (contains digits or has no separator), fall back to "there" — never display an email-derived handle as a name. Add a "Your name" field in `/settings` (and capture it in onboarding) so it can be set.
4. **Test chatter persisted in the hero ("can you hear me…" in the Atlas briefing card).** Clear seeded/test conversation state from the demo/briefing path; the hero must show real content only.
5. **Mobile Leads table broken (`/leads`).** Business name overlaps the vertical column; status/notes clip to unreadable vertical slivers ("Fol / up"). Make it responsive — stack to cards or horizontal-scroll on narrow widths, no overlap, fully legible. This is the most proof-heavy screen; it must be the most legible, not the least.

## B. Outcome reframe (turn activity into results)
1. **Headline.** Replace "Your AI workforce is ready" with an outcome line. Use: **"Your AI workforce is finding leads, drafting outreach, and following up with prospects — around the clock."** (state the outcome, not the vibe.)
2. **Hero = verifiable results row.** Promote the real counts the dashboard already computes (Leads Found, Qualified, Outreach Sent, Meetings Booked — `app/dashboard/page.tsx` ~97–102) to the top, big. These are real and defensible. Add "Hours saved" only if computed from real task time, not invented.
3. **Demote + reframe the Score.** Make it a secondary "team health" tile, not the red hero. Honest sublabel: "Building — climbs as your team books meetings." Recalibrate color bands so a real, early-stage account reads as in-progress, not failing.
4. **Agent cards — add what they do / working on / outcome.** Exact copy:
   - **Aria — Sales Representative:** "Finds and ranks new leads, drafts personalized outreach, and follows up automatically — so no prospect slips through."
   - **Nova — Marketing Director:** "Creates on-brand social posts, content, and campaign ideas you approve in one click."
   - **Opus — Operations:** "Organizes tasks, prepares meeting briefs, and keeps every follow-up on track."
   - **Atlas — Chief of Staff:** "Runs your morning briefing, routes work across the team, and flags what needs your decision."
   Each card also shows current "Working on: …" (real current_task) and the employee's outcome stat.
5. **Trust indicators on leads.** On each lead show the **source** (Google Maps / website / LinkedIn) and a **"verified Xm ago"** stamp — this is what makes "7 leads" read as real, not demo.
6. **Keep Atlas's morning briefing as the hero narrative** ("Aria found 7 leads, Nova drafted 3 posts, here's what needs your approval") — it's already the strongest screen; once #3 above (the username + test chatter) is fixed it lands.

## Honesty guardrails
No invented dollar ROI. Verifiable counts only. If an estimate is ever shown, label it "estimated" with the math visible. Never show a number that can be wrong (like 198/70) — correct or gone.

## Definition of done
`build`/`lint`/`tsc` green. Ship `scripts/verify-credibility.mjs` proving: HoursWidget never yields balance > allowance for a non-internal account; an internal account returns `unlimited`; a fresh+re-granted month resets rather than stacks; `getUserDisplay` returns "there" for handle-like emails (digits/no separator) and the real name when set. (DB firewalled from Cowork — include "run it + report results" in handoff.) List pending migrations. Commit + push, log to `CHANGELOG.md`. Acceptance (Mitri): open the dashboard — results are the hero, every number is correct or absent, your name shows correctly, and nothing reads as demo/broken.
