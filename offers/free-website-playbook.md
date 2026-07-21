# Free-Website Hook — Production Playbook (June 9)

> **What this is:** the free website is the trojan-horse that opens the customer conversation; the AI
> team ($1,500/mo managed) is the product. **Rule: never sell website-only or maintenance-only** —
> that's an agency business (time-for-money, no compounding). The site exists to (a) reverse risk,
> (b) wire the customer's inbound straight into Surge, (c) justify "we run your whole web presence."

## The model
- **Build: free.** Takes us ~1 hour of Mitri's time (see production line below) — the AI does the work.
- **Host + maintain: included in the plan** (not a separate $99/mo line — bundling avoids the
  "what am I paying for" itemization fight and keeps the anchor on booked jobs).
- **The lock-in:** we host it, the domain points at us, and every form/call button feeds
  `/api/inbound/lead` → Aria answers <2 min. Leaving Surge = losing the site + the speed-to-lead.
  That's switching cost ON TOP of the memory moat.

## Stack decision: OWN TEMPLATE, not a site builder (v1)
**Build ONE reusable Next.js template ("Surge Sites") and clone it per customer.** Why this beats
Wix Studio / Framer / Durable for OUR motion:
1. **Least work for Mitri** — Claude Code clones + fills the template; Mitri never touches an editor.
   A builder means Mitri clicking around in a GUI per site; the template means he sends a logo and approves.
2. **$0 marginal cost** — builder fees ($12–40/site/mo: Durable $12–15, Wix ~$17+, Framer seats stack)
   would eat the margin on every account forever. Template sites deploy under our existing Vercel Pro.
3. **Native Surge integration** — the form POSTs straight to `/api/inbound/lead` (consent checkbox =
   ours, anchor adapter A). Builders need webhook glue per site and break the consent chain we control.
4. **On-brand quality** — we already have a design system; vertical pack content (`verticals/
   home-services-pack.md`) pre-loads the copy angles. Durable's 30-second sites look generic — the
   site is supposed to make a roofer look like the biggest operator in town.

**Fallback only:** if a customer insists on self-editing their site, put THAT customer on a builder
(Wix Studio for white-label/multi-client mgmt). Don't make it the default. (Research June 2026:
Wix Studio = best agency multi-site mgmt; Framer = best design control but per-seat/per-language fees
stack; Durable = 30-sec generation, $12–15/mo, weak design control + no real form/webhook control.)

## The production line (per customer, target ≤1 hr of Mitri)
1. **Intake (15 min, Mitri):** business name, services, service area, phone, logo, 5–10 real job
   photos, domain (or we buy one ~$10), Google Business Profile link, license #s.
2. **Generate (0 min Mitri):** Claude Code clones the Surge Sites template; Nova/AI writes the copy
   from the vertical pack (services, trust badges, reviews section, service-area pages for local SEO).
3. **Wire (0 min Mitri):** quote form + click-to-call wired to `/api/inbound/lead` with consent
   checkbox; tracking link domain considerations apply (serve from a clean domain).
4. **Review (15 min, Mitri):** eyeball on phone + desktop; taste pass.
5. **Ship:** point domain, deploy to Vercel, screenshot before/after (the before/after IS sales
   collateral for the next prospect).

## Build order
1. Dev builds the **Surge Sites template** once: single-page + services + quote form + reviews +
   service-area blocks, light theme per customer brand color, form → inbound endpoint. (Claude Code
   prompt to be written when Mitri says go — AFTER the track A/B/C merge + dogfood; this must not
   jump the revenue queue.)
2. First real site = **customer #1's** (the warm contractor). Their before/after becomes the proof.
3. Later: "website included" becomes a productized onboarding step (vertical pack → site auto-draft).

## NORTH-STAR check
Passes: extends a real integration (inbound capture on a surface we own), adds vertical depth
(per-vertical site templates), drives a provable outcome (every site lead answered <2 min, logged in
Surge). Fails ONLY if it drifts into website-only deals — see the rule at the top.
