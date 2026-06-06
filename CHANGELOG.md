# Dev Changelog

Engineering-side log of shipped changes. Per the June 6 sole-writer rule, MEMORY.md
is Cowork's to maintain; the dev records what shipped here (or tells Cowork directly).
Newest first.

## 2026-06-06

### Nova's Studio — her surface, content engine (P1 only) (`prompts/nova-studio-prompt.md`)
Nova (Marketing Director, green) now has a surface, the way Aria has /leads. P1: she
generates on-brand marketing content from the shared company brain → owner approves/
edits/archives. NOTHING is published (P2 publishing + P3 video are explicitly OUT, and
the schema is designed additive for them — Architecture Law #4).
- **`app/api/studio/run`** — same agent pattern as Aria's run, trimmed for content (no
  web search). Pulls brand voice + ICP + offer from `memory_entries` + the company
  profile and drafts a batch via a `create_content_piece` tool (post | script | ugc_brief
  | caption, platform-native). **Refuses to invent**: if there's no brand voice it returns
  `no_brand_voice` and points to onboarding — never generic filler, no spend. Metered as
  `nova_content` (1h) via `lib/hours.mjs` (gate up front, debit on completion, `is_internal`
  bypass, 0 on a thin/failed run).
- **`/studio`** (mirrors /leads quality) — Nova's identity up top (her **PresenceOrb**,
  shipped earlier this session, reacting while she drafts; her green; her focus line), a
  create affordance (own angle or "Surprise me from our brand"), content grouped by type
  with per-piece approve / edit / archive / copy-to-clipboard (clipboard = the v1 human
  handoff), intentional empty state, hover/press micro-interactions, light theme. Added
  **Studio** to the sidebar. `lib/content.ts` is the data layer.
- **Migration (PENDING — Cowork to run): `supabase/content_migration.sql`** — `content_pieces`
  (type/platform/status/brief) with RLS consistent with leads/lead_drafts.
- **Verify:** `scripts/verify-nova-studio.mjs` — persistence + RLS isolation, status
  transitions draft→approved→archived, metering (1h, debits once, `is_internal` bypass with
  a one-off service key), and the no-brand-voice refusal (no spend). Optional end-to-end
  real run behind `RUN_NOVA=1`. Run it and report: `node scripts/verify-nova-studio.mjs`.
- build / lint / tsc green.

### Weekly CEO Briefing email — the day-14 retention anchor (`prompts/weekly-briefing-email-prompt.md`)
Lever 2 (a reason they stay): every Monday ~08:00 in the owner's timezone, Surge emails
a one-page summary of what the workforce did, what's planned, and what needs them —
"makes inaction feel like losing money" (CEO.md Failure Point #2). Extends the EXISTING
daily heartbeat cron (no second scheduler).
- **`lib/briefing.mjs`** (shared ESM): pure tz helpers (`isoWeekKey`, `isMondayInTz`,
  `scoreDelta`); `buildWeeklyBriefing` reuses the SAME inputs + score formula as the
  in-app `/briefing` page (email and app never disagree); `renderBriefingEmail` (light-
  theme, mobile-readable HTML + text, the Number prominent with a ▲/▼ vs last week);
  `sendWeeklyBriefingForCompany` — idempotent, quiet-week nudge, not-onboarded skip.
- **The Number first**, then what the team did this week (leads researched, emails sent,
  leads gone warm, meetings booked — concrete real counts, empty sections omitted), what
  needs you (pending approvals / overdue Lifeline, with one-click deep links), what's
  planned, and one calm Atlas sign-off line (a single focus for the week).
- **Cron** (`app/api/cron/heartbeat`): after the daily sweep, for each onboarded company,
  if it's Monday in its tz → send the weekly briefing. Daily drip unchanged.
- **Idempotent + honest**: `briefing_sends` (PK `company_id,week_key`) blocks a retry
  double-send and stores each week's score for next week's delta. Zero-activity weeks get
  a gentle "one move to make" nudge, not an empty report. Not-onboarded companies skipped.
- **Not metered** (owner comms, not AI work); `is_internal` still receives it. Sent via
  the transactional `notifyOwner` (no CAN-SPAM footer/warmup); footer points to Settings.
- **Migration (PENDING — Cowork to run): `supabase/briefing_migration.sql`** — adds
  `briefing_sends` + `companies.timezone` (nullable → defaults to America/Chicago).
- **Verify:** `scripts/verify-weekly-briefing.mjs` — tz-aware week key + Monday detection,
  delta math, and (after the migration) idempotency blocks double-send, quiet-week path,
  not-onboarded skip. Run it and report: `node scripts/verify-weekly-briefing.mjs`.
- build / lint / tsc green.

### The Wedge — lead-gen loop: deeper research + warm-signal + owner ping (`prompts/wedge-leadgen-loop-prompt.md`)
Extends the existing engine (no rebuild). The loop: research a big scored pipeline →
draft with ONE tracked CTA link per lead → owner approves → paced sends → prospect
clicks/books → lead auto-promotes to warm → owner pinged. The warm signal is an ACTION
(a click/booking), never us reading replies — reply-to stays the customer's own inbox.
- **Deeper research** — `app/api/agent/run`: ceiling 18→30 iterations; the run prompt now
  targets **30–50+ real scored leads** (batch many `create_lead` calls per turn), keeps
  the 0–100 rubric, and explicitly separates the two numbers (leads researched scales;
  emails sent stays warmup/CAN-SPAM-capped). Never invents leads to hit a number.
  Metering unchanged (gated/debited via `lib/hours.mjs`, `is_internal` bypass, 0 on thin).
- **Tracked CTA (the warm signal)** — `lib/sign.mjs`: HMAC-signed, tamper-proof per-lead
  token (no raw ids in the URL). Every draft embeds exactly ONE signed link
  (`embedTrackedCta` at draft time + a guard in `deliverDraft`) via a `{{CTA_URL}}`
  placeholder the writer leaves.
- **Redirect + booking** — `app/api/r/[token]` verifies the token and calls the
  SECURITY-DEFINER `register_link_click` RPC (anon-safe): increment `click_count`, stamp
  `first_clicked_at`, promote new/qualified/drafted/contacted → **warm** (never downgrade
  replied/meeting), refresh the Lead Lifeline, log activity — then 302 to the customer's
  `booking_url` or the hosted interest page `app/book/[token]` (→ `register_booking` →
  status `meeting` + `booked_at`). Idempotent: repeat clicks/bookings don't re-promote.
- **Owner notification** — on the real new→warm transition (and on booking) Aria emails
  the owner in-voice ("just clicked your link — they're warm") via a transactional
  `notifyOwner` (no footer/warmup — it's a 1:1 product ping), plus an activity-feed row.
  Fires exactly once per event.
- **Surfaces** — `/leads` sorts warm/booked to the top with a 🔥 count, status pill,
  click count + first-clicked, and booked date; `settings` adds an optional booking link
  (Calendly opt-in; blank = hosted page); the Workforce Score pipeline component now
  weights engaged (warm/booked) leads 2× (`lib/score.mjs` `leadsEngaged`, reused — not
  forked; backwards-compatible).
- **Migration (PENDING — Cowork to run): `supabase/warm_signal_migration.sql`** — adds
  `leads.first_clicked_at/click_count/booked_at`, `companies.booking_url`, `'warm'` to the
  status check, and the two anon-granted SECURITY DEFINER RPCs.
- **Verify:** `scripts/verify-wedge.mjs` — token sign/verify round-trip + tamper/wrong-secret
  rejection (passing now); and live (after the migration) click→warm + increment +
  idempotent, booking→meeting+booked_at, and status-never-downgrades. Run it and report:
  `node scripts/verify-wedge.mjs` (Confirm-email OFF; no service key needed).
- build / lint / tsc green. Optional: set `SURGE_LINK_SECRET` in Vercel + `.env.local` to
  pin link validity across key rotations (defaults to an existing stable secret).

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
