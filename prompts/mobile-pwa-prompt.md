# Build: Mobile pass + PWA (one combined job)

Read CLAUDE.md, MEMORY.md, CEO.md first. Surge is LIVE at https://surgehq.io (Vercel, auto-deploy on push to main). This job is a HARD GATE before any cold email goes to prospects — they open email on phones, they hit mobile first, and right now the mobile experience is broken.

## Part 1 — Mobile responsive pass (the gate)
Mitri viewed surgehq.io on his phone: "couldn't navigate through it." Fix the LANDING page (`app/landing/page.tsx`) and verify the whole app is usable at phone width.
- **Header nav**: Team / Pricing / FAQ / Get started must collapse into a hamburger menu on narrow screens (it currently doesn't). Working open/close, tappable links, closes on selection.
- **Responsive breakpoints**: hero, team cards (2×2 → stack), pricing tiers (3-col → stack), score section, FAQ, footer all readable and well-spaced at 390px. No horizontal scroll, no overflow, no overlapping text.
- **Tap targets**: buttons/links ≥44px, comfortable spacing.
- **The app pages too** (dashboard, leads, tasks, memory, onboarding chat, settings): confirm they're usable on a phone — sidebar should collapse/drawer on mobile, tables scroll or reflow, the Atlas/chat input works. Landing is the priority (prospects see it first); app pages are second.
- **Test at 390px AND on a real phone** before calling it done. Mitri will re-check on his phone — that's the acceptance test.
- Note: the "fake stats on mobile" Mitri saw were his phone's BROWSER CACHE of the pre-honesty-pass build. The live page is verified clean. This task is responsiveness/nav ONLY, not content.

## Part 2 — PWA (the "app" Mitri asked for, stage-appropriate)
Make the existing site installable so it gets a home-screen icon and opens full-screen — app feel, one codebase, no app store. Decision rationale in MEMORY (PWA now, native later after customer #1).
- **Web app manifest** (`app/manifest.ts` or `public/manifest.webmanifest`): name "Surge", short_name "Surge", display "standalone", theme/background colors from globals.css (indigo #6366f1 / light), start_url "/dashboard", scope "/".
- **Icons**: 192px, 512px, and a maskable 512px, plus apple-touch-icon. Use the Surge "S" mark (indigo rounded square already in the sidebar/logo) — generate the PNG sizes from it.
- **iOS bits**: apple-touch-icon link + apple-mobile-web-app-capable / status-bar meta in the root layout (iOS doesn't read the manifest for these).
- **Service worker**: minimal, for installability + an offline fallback page. Use `@ducanh2912/next-pwa` or `next-pwa` (Next 16 App Router compatible) OR a hand-rolled SW registered client-side — keep it simple, don't over-cache (stale auth/data is worse than a network wait; network-first for app routes, cache-first only for static assets/icons).
- **Push notifications: scaffold but OFF.** Wire the SW to be push-capable but do NOT request notification permission or send anything yet. Push is for Atlas's morning brief later (Level 4) — leave a clear TODO. Don't prompt users for notifications on first visit (instant uninstall trigger).
- Verify: Chrome/Edge shows "Install app", Lighthouse PWA checks pass, installs to home screen on a real phone and opens full-screen.

## Out of scope (explicitly)
- NO native iOS/Android app. That's a separate post-customer-#1 project (MEMORY logged). Do not start it.
- NO push notifications actually firing yet.

## Definition of done
build/lint/tsc green, deployed to surgehq.io, Mitri confirms on his phone (mobile nav works + installs to home screen). THEN the launch sequence continues: confirm-email flip → send-freeze lifts.
