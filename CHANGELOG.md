# Dev Changelog

Engineering-side log of shipped changes. Per the June 6 sole-writer rule, MEMORY.md
is Cowork's to maintain; the dev records what shipped here (or tells Cowork directly).
Newest first.

## 2026-06-06

### voice-alive Track B — living-presence orb (`prompts/orb-kickoff-prompt.md`)
- **`components/PresenceOrb.tsx`** — a WebGL (Three.js + GLSL fragment shader)
  "living presence" replacing the static text-box framing. Domain-warped simplex-noise
  FBM renders fluid, organic, glowing liquid-light — not a CSS pulse. Props
  `{ employeeId, state, size?, analyser?, level? }`.
- **Stable identity + living modulation.** `lib/persona-orb.ts` centralizes the signature
  colours (Aria `#a78bfa`, Nova `#34d399`, Opus `#60a5fa`, Atlas `#f59e0b`) and the
  per-state params (`idle`/`thinking`/`talking`/`working`/`done`/`needs-owner`): motion
  speed, turbulence, glow, and a hue tint mixed on top of the fixed base colour. State
  params ease so transitions are graceful.
- **Reads on LIGHT surfaces.** Luminance-aware deepening + capped brightness + a defined
  contact-ring so high-luminance hues (Atlas amber) hold their shape on the light theme
  instead of washing into white.
- **Audio-reactive seam.** A real Web Audio `AnalyserNode` (RMS of the time-domain
  waveform) drives amplitude when passed — this is the clean hook for Track A's
  ElevenLabs playback. Until then `talking` self-animates a synthetic speech cadence (or
  an explicit `level`), so it feels alive today with NO API key.
- **Performance.** GPU shader, single mesh, `requestAnimationFrame`, DPR capped at 2,
  loop paused when the tab is hidden or the orb scrolls offscreen (IntersectionObserver).
- **Wired to real state.** `AtlasBrief` shows the Atlas orb as the dashboard centerpiece
  (thinking while a request is in flight → talking while his reply streams). `ChatPanel`
  gets a presence header that reacts the same way, plus a `working` state when the
  employee has an in-progress task (passed from `app/workforce/[id]`).
- Adds `three` + `@types/three`. build / lint / tsc green. Verified visually (clean dev
  render): all six states, four distinct identity colours, all reading on the light surface.

### ops-now — owner-unlimited account + Sentry error alerting (`prompts/ops-now-prompt.md`)
- **`is_internal` owner-unlimited flag.** `supabase/internal_flag_migration.sql` adds
  `companies.is_internal`, flags Mitri's Surge company, and HARDENS it with a trigger
  (`surge_protect_is_internal`) so the authenticated/anon roles can never self-grant it
  — the `companies_own` RLS policy is `FOR ALL`, so without this any owner could update
  their own row to unlimited. `lib/hours.mjs`: `isInternal()`, `gateWork()` bypass, and
  `debitHours()` no-op for internal (fails closed on read error). Display: `unlimited`
  flag on `getHoursSummary` → "Unlimited" in HoursWidget + settings.
  Verify: `scripts/verify-internal.mjs` (self-grant-blocked check runs on anon; positive
  bypass needs a one-off service key).
- **Sentry error alerting.** `@sentry/nextjs` wired via `instrumentation.ts`
  (`onRequestError`), server/edge/client configs, and `app/global-error.tsx`. Dormant
  until `NEXT_PUBLIC_SENTRY_DSN` is set, production-only. `app/api/debug-error`
  (CRON_SECRET-gated) fires one real prod error to confirm alerting reaches email.
- **Mitri's manual steps:** apply `internal_flag_migration.sql`; create Sentry project +
  paste `NEXT_PUBLIC_SENTRY_DSN` (+ optional `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/
  `SENTRY_PROJECT` for source maps) in Vercel; set a Sentry alert rule → email
  garibmitri1@gmail.com; redeploy; hit `/api/debug-error?key=<CRON_SECRET>` to test.

### friends-feedback — P0 + P1 (`prompts/friends-feedback-fixes-prompt.md`)
- **P0** real signed-in user name (killed hardcoded "Mitri") via `getUserDisplay()` in
  dashboard/briefing/Sidebar. **P0** mobile `/tasks` horizontal scroll so Run is
  reachable at 390px.
- **P1** voice input (`components/MicButton.tsx`, Web Speech STT) on chat/Atlas/intake.
- **P1** image upload (`components/ImageButton.tsx` + `parseImageDataUrl` vision block in
  `app/api/chat/route.ts`) on chat + intake.
- **P1** onboarding trim (chat-prompt INTAKE rules: <5 min, batchable, skippable).
- **P1.4** TTS (`components/SpeakButton.tsx`, Web Speech SpeechSynthesis) — NOTE: Mitri
  has since flagged the free browser TTS as robotic; the human-voice upgrade
  (ElevenLabs voices + Whisper STT + animated Atlas orb) is queued for after the launch
  gates per his June 6 direction.
