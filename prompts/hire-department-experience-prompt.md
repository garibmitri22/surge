# Kickoff: Hire-an-employee + Department experience (clarity + expansion + upsell)

First read `MEMORY.md` ("AI Employees", "Workforce Architecture Laws") and `CEO.md`. From the review: the "Hire Employee" action should be the coolest moment in the product but feels like a plain button, and the org reads as a flat list of agents instead of a company. This addresses the reviewer's "Hire Employee" + "Department View" items (Conversion + Clarity), reinforces the expansion path investors liked, and powers Atlas's organic upsell. Build on the existing workforce pages — don't rebuild.

## 1. Department view (make it feel like a company)
- Group the workforce by **department**, not a flat grid: **Leadership** (Atlas), **Sales** (Aria), **Marketing** (Nova), **Operations** (Opus). Each department header + the employees under it, each card carrying the what-they-do / working-on / outcome copy from the credibility pass.
- This is the structure the org-chart concept promises ("CEO → Chief of Staff → Sales/Marketing/Ops"). Use it on `/workforce` and reflect it in the dashboard roster.

## 2. The Hire experience (the cool moment)
- "Hire Employee" opens a **hiring catalog organized by department**, like staffing a company:
  - **Sales:** Aria (Sales Rep) — active. Future roles (Account Executive, etc.) shown as **"Coming soon"** — honestly labeled, never fake-available.
  - **Marketing:** Nova (Marketing Director) — active. (Content Writer, SEO Specialist — coming soon.)
  - **Operations:** Opus (Operations) — active. (Project Manager — coming soon.)
  - **Pipeline employees** from MEMORY (Rex/Recruiter, Clara/Customer Service, Evan/EA, Piper/PM, Finn/Finance) appear here as **"Join waitlist"** — this is the visible expansion path.
- Each catalog card: avatar, name, role, the one-line outcome description, and a clear CTA — "Hire" (active) or "Coming soon / Join waitlist". Make it feel like adding a teammate (a confirgener moment / brief celebratory state), not submitting a form.
- **"Hire" wiring:** adding an active employee enables them on the team. Gate by plan once Stripe lands (`prompts/stripe-billing-prompt.md`: single = the one chosen employee, team = all); until billing ships, owner/`is_internal` can enable freely. Don't half-build billing here — just leave the entitlement check as the seam.

## 3. Tie to upsell (revenue)
- When a need shows up in another lane, Atlas can nudge organically ("that's Nova's lane — want to bring her on?") linking into this hire flow. Keep it one calm line, no nagging (per Atlas's persona).

## Honesty + architecture
- Coming-soon/waitlist roles must be clearly not-yet-available — no fake rosters. Adding employees stays additive (Architecture Law #1/#4): the department + catalog are data-driven so role #5/#10 needs no rewrite. Light theme, empty/zero states intentional, hover/press micro-interactions (CEO.md Three Gaps).

## Definition of done
`build`/`lint`/`tsc` green. Workforce + dashboard show departments; Hire opens a department-organized catalog with active vs coming-soon/waitlist clearly distinguished; hiring an active employee enables them (entitlement seam in place for Stripe); waitlist signups are captured. Commit + push, log to `CHANGELOG.md`. Acceptance (Mitri): opening Surge feels like running a company with departments, and "Hire" feels like staffing one — with an obvious path to add more.
