import type { VerticalPack } from './types';

// Home Services pack (roofing · HVAC · flooring). Structured from
// verticals/home-services-pack.md. To add vertical #2 (med spas): drop a new file
// like this one and register it in ./index — no new code.
export const homeServices: VerticalPack = {
  id: 'home-services',
  label: 'Home Services',
  sub: 'Roofing · HVAC · flooring',
  industry: 'Home services',

  // The four required brain entries (singletons) — confirm-not-fill starting points.
  memory: [
    {
      type: 'icp',
      title: 'Ideal customer (home services)',
      content:
        'Homeowners with an urgent or near-term need. Roofing: storm/hail damage, active leaks, 20+ yr roofs, pre-sale. HVAC: no-cooling / no-heating emergencies, aging-system replacement, maintenance plans. Flooring: remodels, water-damage replacement, pre-sale upgrades, landlord unit turns. SKIP or nurture: renters, and "someday" projects with no date. Segment by URGENCY — an active leak or dead AC books today; a someday remodel is a nurture.',
    },
    {
      type: 'offer',
      title: 'What you sell',
      content:
        'Residential roofing / HVAC / flooring services. You win on speed + trust: answer every lead in minutes, licensed & insured, local, real reviews, financing available. The promise to the homeowner is a fast, no-pressure estimate and a job done right — booked estimates, not software.',
    },
    {
      type: 'voice',
      title: 'Brand voice',
      content:
        'Fast, plain-spoken, trustworthy, local. No corporate fluff, no hype. Lead with responsiveness and proof (years in business, licensed/insured, reviews, real address). Homeowners fear getting ripped off or ghosted — counter both.',
    },
    {
      type: 'goal',
      title: 'Primary goal (90 days)',
      content:
        'Booked estimates. Answer every inbound lead within ~2 minutes, follow up until they book, and rebook the existing customer + unclosed-quote list. Channels first: inbound speed-to-lead + database reactivation.',
    },
  ],

  // Message templates + playbook → stored as 'process' brain entries the team reads.
  templates: [
    {
      title: 'Speed-to-lead SMS templates',
      content:
        'Fire within 2 min of a new inbound (consented). Roofing: "Hi [Name], it\'s [Company] — got your request about your roof. Are you seeing a leak or active damage right now, or planning ahead? I can have someone out this week." HVAC: "Hi [Name], [Company] here — saw your message about your AC/heating. Is it currently not working, or replacing an aging system? We can get a tech scheduled fast." Flooring: "Hi [Name], it\'s [Company] — thanks for reaching out about new flooring. What rooms, and is there a date you\'re working toward? Happy to set up a free measure." Email subjects: "Quick question about your [roof/AC/flooring]" · "Got your request — when works for a free estimate?"',
    },
    {
      title: 'Reactivation templates',
      content:
        'Old unclosed quote: "Hi [Name], it\'s [Company]. We quoted your [roof/AC/floor] back in [month] — still on your list? Prices and lead times are better than they were; want me to refresh your quote?" Past customer (maintenance/cross-sell): "Hi [Name], [Company] here — it\'s been about [X] since we did your [job]. Want a quick maintenance check before [season]? Keeps it under warranty and avoids surprises." Seasonal: roofing pre-storm inspection; HVAC pre-summer tune-up / pre-winter heat check; flooring spring-remodel push.',
    },
    {
      title: 'Objection handling',
      content:
        'Too expensive: "Totally fair — most of our customers finance it; want the monthly option? One storm/breakdown usually costs more than the fix." Let me think about it: "Of course. Want me to hold your quote and check back in a few days? No pressure — just don\'t want lead times to creep." I already have a guy: "Makes sense. Worth a second number for emergencies or a quick second opinion? I\'ll keep it on file." Are you legit?: lead with licensed/insured, years local, reviews, real address.',
    },
    {
      title: 'Nova content angles (home services)',
      content:
        'Seasonal + conversion-oriented: storm-season "what to do after hail" + insurance-claim help; before/after job reels (highest-converting); financing explainers; "5 signs your roof/AC needs replacing"; review/testimonial spotlights; beat-the-summer-rush AC urgency. Short-form video beats static.',
    },
  ],

  // Tilts the 0–100 lead-scoring rubric for this vertical (read by Aria's run).
  scoringTilt:
    'Weight URGENCY highest (active leak / no AC / no heat = top). Then job size (roof replace > repair), homeowner (not renter), in service area, insurance/storm involvement (roofing), and reachability. A "someday" remodel with no date scores low → nurture, not call-now.',

  // Starter content drafts seeded into Nova's library (editable, pending approval).
  content: [
    {
      type: 'post', platform: 'linkedin',
      title: '5 signs your roof needs replacing',
      body: '5 signs it\'s time to replace your roof (not just patch it):\n\n1. Shingles curling or missing after a storm\n2. Granules collecting in your gutters\n3. Daylight or stains in the attic\n4. It\'s 20+ years old\n5. A neighbor just got hail damage approved by insurance\n\nNot sure? A free inspection takes 20 minutes and tells you exactly where you stand — no pressure.',
      brief: 'Educational/urgency post — homeowner awareness, drives free-inspection bookings.',
    },
    {
      type: 'script', platform: 'tiktok',
      title: 'Before/after job reel (15s)',
      body: 'HOOK (0-2s): "This roof was one storm away from leaking into their living room."\n2-8s: quick pans of the damaged roof / old AC / worn floor (real job footage).\n8-12s: the finished result, clean and done.\n12-15s: on-screen text "Free estimate, booked in minutes." VO: "Licensed, insured, and local — we answer fast."\nCTA: "DM \'estimate\' or tap the link."\n(Illustrative — use your own real job footage; never present a stock scenario as a real customer.)',
      brief: 'Before/after reel — the highest-converting home-services format.',
    },
    {
      type: 'caption', platform: 'instagram',
      title: 'Beat-the-rush seasonal urgency',
      body: 'The first 90°F week is when everyone\'s AC dies at once — and the wait for a tech jumps to days. Get your system checked now and skip the line. Quick, no-pressure tune-up; we\'ll tell you straight if it\'s good for another season. Link to book 👇',
      brief: 'Seasonal urgency caption — pre-summer HVAC tune-up demand.',
    },
  ],
};
