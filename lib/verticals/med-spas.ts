import type { VerticalPack } from './types';

// Med Spas pack — vertical #2. Proves the design: a new pack file + one line in
// ./index, no new code. The "company" is a med-spa OWNER using Surge for their own
// business; the leads are their patients/prospects (consult requests, lapsed patients,
// expiring packages). Mirrors home-services.ts structure exactly.
export const medSpas: VerticalPack = {
  id: 'med-spas',
  label: 'Med Spa / Aesthetics',
  sub: 'Botox · filler · laser · memberships',
  industry: 'Med spa / aesthetics',

  memory: [
    {
      type: 'icp',
      title: 'Ideal customer (med spa)',
      content:
        'Prospects and patients with a near-term aesthetic intent. Hot: someone who asked about a specific treatment (Botox, filler, laser hair removal, facials, body contouring) with a date or event in mind; lapsed patients due for re-treatment (Botox ~3-4 mo, filler ~6-12 mo); expiring packages/memberships. SKIP or nurture: pure price-shoppers with no treatment in mind and no timeframe. Segment by readiness — a specific treatment + a timeframe books a consult now; "just researching" is a nurture.',
    },
    {
      type: 'offer',
      title: 'What you sell',
      content:
        'Aesthetic treatments and memberships (injectables, laser, skin, body). You win on trust and convenience: licensed injectors/providers, natural-looking results, a comfortable discreet experience, easy booking, and memberships/financing that make it affordable. The promise: a no-pressure consult and results from people they can trust with their face.',
    },
    {
      type: 'voice',
      title: 'Brand voice',
      content:
        'Warm, polished, reassuring, discreet. Confidence without hype; never pushy or salesy about appearance. Lead with expertise and safety (licensed providers, experience, real reviews) and a welcoming, judgment-free tone. Avoid clinical coldness and avoid body-shaming language.',
    },
    {
      type: 'goal',
      title: 'Primary goal (90 days)',
      content:
        'Booked consults and appointments. Answer every inbound inquiry within ~2 minutes, follow up until they book, and rebook lapsed patients + expiring packages. Channels first: inbound speed-to-lead + database reactivation.',
    },
  ],

  templates: [
    {
      title: 'Speed-to-lead SMS templates',
      content:
        'Fire within 2 min of a new inbound (consented). General: "Hi [Name], it\'s [Spa] — thanks for reaching out! Which treatment are you most curious about, and is there a date or event you\'re working toward? Happy to set up a quick consult." Injectables: "Hi [Name], [Spa] here — got your question about Botox/filler. First time, or a touch-up? I can get you in with one of our injectors this week." Laser/package: "Hi [Name], it\'s [Spa] — laser hair removal works best as a series; want me to book a free consult so we can map out your plan and pricing?" Email subjects: "Quick question about your [treatment]" · "Got your request — when works for a free consult?"',
    },
    {
      title: 'Reactivation templates',
      content:
        'Lapsed Botox/filler: "Hi [Name], it\'s [Spa] — it\'s been about [X] months since your last visit, so your results may be softening. Want me to get you back on the schedule before [event/season]? We have openings this week." Expiring package/membership: "Hi [Name], heads up from [Spa] — you have [N] sessions left on your package expiring [date]. Want me to help you use them before they\'re gone?" Seasonal: pre-summer laser series; pre-wedding/holiday glow packages; new-treatment announcements to past patients.',
    },
    {
      title: 'Objection handling',
      content:
        'Too expensive: "Totally fair — most patients use our membership or financing to spread it out; want me to send the monthly option? The consult is free and no-pressure." Nervous/first time: "Completely normal — our injectors are licensed and go slow, natural-looking results only. A consult is just a conversation; no commitment." Let me think about it: "Of course — want me to hold a consult slot and check back in a few days? No pressure." Are you legit?: lead with licensed providers, years of experience, before/afters (with consent), and real reviews.',
    },
    {
      title: 'Nova content angles (med spa)',
      content:
        'Education + trust + tasteful results: treatment explainers ("Botox vs filler — what each actually does"), provider spotlights (the human behind the needle), consented before/after results, myth-busting ("will I look frozen?"), seasonal promos (pre-summer, holiday glow), membership value, skincare tips. Tasteful and confidence-building, never body-shaming. Short-form video + carousels convert best.',
    },
  ],

  scoringTilt:
    'Weight READINESS-TO-BOOK highest (named a specific treatment + a date/event = top; lapsed patient due for re-treatment or expiring package = hot). Then in service area, realistic budget/financing fit, and reachability. A vague "just researching" with no treatment or timeframe scores low → nurture, not call-now.',

  content: [
    {
      type: 'post', platform: 'instagram',
      title: 'Botox vs filler — what each actually does',
      body: 'Botox vs filler — quick, no-jargon:\n\n• Botox relaxes muscles → softens lines from movement (forehead, crow\'s feet, "11s").\n• Filler adds volume → restores cheeks, lips, under-eyes, smile lines.\n\nMost first-timers do a little of one, not a lot of anything — natural is the goal. Not sure what you need? A free consult takes 15 minutes and you leave with a plan, no pressure.',
      brief: 'Education post — builds trust + drives free-consult bookings (top-of-funnel).',
    },
    {
      type: 'script', platform: 'tiktok',
      title: 'Provider spotlight (20s)',
      body: 'HOOK (0-2s): "The #1 thing people ask before their first Botox: \'will I look frozen?\'"\n2-10s: provider on camera, warm + real: "No — we go conservative and natural. You\'ll still make every expression, just softer lines."\n10-16s: quick clip of the calm, clean treatment room.\n16-20s: on-screen text "Free consult — no pressure." VO: "Licensed, experienced, and here to answer every question."\nCTA: "DM \'consult\' or tap the link." (Any patient shown must give written consent; never present a stock person as a real patient.)',
      brief: 'Provider spotlight — humanizes the brand, addresses the top first-timer fear.',
    },
    {
      type: 'caption', platform: 'instagram',
      title: 'Pre-summer laser series urgency',
      body: 'Laser hair removal takes a series of sessions — so the time to start for smooth, summer-ready skin is now, not June. Book a free consult this month and we\'ll map your plan + pricing (and our package makes it easy). Spots go fast once it warms up 👇',
      brief: 'Seasonal urgency caption — drives pre-summer laser package consults.',
    },
  ],
};
