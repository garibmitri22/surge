# Vertical Pack — Home Services (roofing · HVAC · flooring)

The pre-loaded "company brain" + content + onboarding defaults that make Surge feel built for home-services contractors. Two uses: (1) seed a new customer's memory/onboarding so it's confirm-not-fill; (2) source our OWN Aria's outreach when selling Surge into this vertical. This file is the template — clone it for vertical #2 (med spas). *Config + content, not new code.*

## Positioning (what Surge does for them)
"Surge makes sure every lead your ads and referrals generate gets answered in seconds and followed up until they book — and it wakes up the old quotes and past customers you never had time to chase." Outcome = booked jobs, not software.

## Who the CUSTOMER is (our ICP for selling Surge)
Residential roofing, HVAC, or flooring owner-operators doing real volume ($500K–$5M/yr), 1–25 staff, already spending on ads (Meta/Google/LSA) or buying leads (Angi), and losing money to slow follow-up + an unworked customer list. Hot signal: running the same ad 4+ months (see `outreach/active-advertiser-outreach.md`).

## Who the CONTRACTOR'S customers are (for their lead gen)
- **Roofing:** storm/hail damage (urgent, insurance-driven), aging roof (20+ yrs), real-estate-driven (selling/buying), leaks (emergency).
- **HVAC:** no-cooling/no-heating emergencies (hottest leads), aging system replacement, maintenance plans, new installs.
- **Flooring:** remodels, water-damage replacement, pre-sale upgrades, landlords turning units.
Segment by URGENCY — an active leak or dead AC books today; a "someday remodel" is a nurture.

## Brand voice defaults (home services)
Fast, plain-spoken, trustworthy, local. No corporate fluff, no hype. Lead with responsiveness and proof (years in business, licensed/insured, reviews, local). Homeowners fear getting ripped off or ghosted — counter both.

## Speed-to-lead templates (new inbound — fire within 2 min)
*SMS (consented):*
- Roofing: "Hi [Name], it's [Company] — got your request about your roof. Are you seeing a leak or active damage right now, or planning ahead? I can have someone out to look this week."
- HVAC: "Hi [Name], [Company] here — saw your message about your AC/heating. Is it currently not working, or are you looking to replace an aging system? We can get a tech scheduled fast."
- Flooring: "Hi [Name], it's [Company] — thanks for reaching out about new flooring. What rooms are you thinking about, and is there a date you're working toward? Happy to set up a free measure."
*Email subject lines:* "Quick question about your [roof/AC/flooring]" · "Got your request — when works for a free estimate?"

## Reactivation templates (existing CONSENTED list — the fast money)
- Old unclosed quote: "Hi [Name], it's [Company]. We quoted your [roof/AC/floor] back in [month] — wanted to check if it's still on your list. Prices and lead times are better than they were; want me to refresh your quote?"
- Past customer (cross-sell/maintenance): "Hi [Name], [Company] here — it's been about [X] since we did your [job]. Want us to schedule a quick maintenance check before [season]? Keeps it under warranty and avoids surprises."
- Seasonal: roofing pre-storm-season inspection; HVAC pre-summer tune-up / pre-winter heat check; flooring "spring remodel" push.

## Objection handling (one calm line each)
- "Too expensive": "Totally fair — most of our customers finance it; want me to send the monthly option? And one storm/breakdown usually costs more than the fix."
- "Let me think about it": "Of course. Want me to hold your quote and check back in a few days? No pressure — just don't want lead times to creep on you."
- "I already have a guy": "Makes sense. Worth a second number for emergencies or a quick second opinion? I'll keep it on file either way."
- "Are you legit?": lead with licensed/insured, years local, reviews, real address.

## Lead-scoring tilt (tune the 0–100 rubric for this vertical)
Weight URGENCY high (active leak / no AC / no heat = top). Then job size (roof replace > repair), homeowner (not renter), in service area, insurance/storm involvement (roofing), and reachability. A "someday" remodel with no date scores low → nurture, not call-now.

## Nova content angles (seasonal, conversion-oriented)
Storm-season "what to do after hail" + insurance-claim help; before/after job reels (the highest-converting home-services content); financing explainers; "5 signs your roof/AC needs replacing"; review/testimonial spotlights; seasonal urgency (beat-the-summer-rush AC). Short-form video > static.

## Compliance (bake in, don't bolt on)
TCPA consent before any automated SMS/call (see inbound + reactivation specs); email = established-business-relationship + CAN-SPAM (address + unsubscribe, built). Never claim guaranteed insurance approval or specific savings. Honor licensing-claim accuracy per state.

## Onboarding defaults (confirm-not-fill)
Pre-fill: industry = home services (sub: roofing/HVAC/flooring), ICP = the homeowner segments above, brand voice = the defaults above, primary goal = booked estimates, channels = inbound speed-to-lead + reactivation first. The owner just confirms/edits + uploads their past-customer list and connects their ad accounts.

## Dev wiring (small)
Make vertical packs a selectable template: on onboarding, "What kind of business?" → home services prefills `memory_entries` (ICP/voice/offer), seeds the content library + message templates, and tilts the lead-scoring weights. Data-driven so adding vertical #2 (med spas) is a new pack file, not new code. Honest: templates are starting points the owner edits, not locked.
