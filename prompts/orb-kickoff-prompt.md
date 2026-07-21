# Kickoff: Track B — Living-presence orb (START NOW, no API key needed)

First read `CLAUDE.md`, `MEMORY.md` (see "🔥 CRITICAL PATH — FEEL HUMAN / ALIVE"), and the full spec `prompts/voice-alive-prompt.md` — **build Track B only** for this task. Track A (ElevenLabs voices) is blocked on a key and is NOT in scope here. Track B has zero dependencies — build it now.

## What to build
An animated WebGL "living presence" orb that replaces the static text-box framing. Each employee becomes a glowing, breathing orb whose **identity is fixed** (name + signature color) and whose **life modulates on top** (motion, turbulence, glow, hue tint, audio-reactive flow) by state.

A visual prototype has already been approved — match its look and behavior. Signature colors and per-state parameters below are the spec, not suggestions.

## Hard requirements
- **WebGL/shader (Three.js + GLSL fragment shader).** Fluid, organic, glowing liquid-light — NOT a CSS pulse or flat circle. If you cannot hit this bar, STOP and flag it (we bring in a shader/Rive specialist) rather than shipping a weak version.
- **Stable identity:** Aria `#a78bfa` (purple), Nova `#34d399` (green), Opus `#60a5fa` (blue), Atlas `#f59e0b` (amber). Always recognizable who-is-who.
- **Living modulation by state** — modulate motion speed, turbulence, glow, and a hue tint on top of the fixed base color. Target params (from the approved prototype):
  - `idle` — slow calm breathing (speed ~0.5, turb ~0.55, glow ~0.55)
  - `thinking` — faster shimmer (speed ~1.7, turb ~1.05)
  - `talking` — flows with the audio (speed ~1.2, turb ~1.25, glow ~0.95, amplitude-driven edge)
  - `working` — active churn (speed ~1.0, turb ~1.7)
  - `done` — brief green-tinted pulse (mix base ~38% toward `#34d399`, pulse on)
  - `needs-owner` — attention tone (mix base ~38% toward `#f87171`, stronger pulse)
- **Audio-reactive (real, not faked):** Web Audio `AnalyserNode` reads actual playback amplitude to drive the orb on `talking`. Until Track A voices land, drive it from text-stream cadence as a stand-in, with a clean seam to swap in the real analyser later.
- **Performance:** `requestAnimationFrame`, GPU shader, cap devicePixelRatio (~2). Pause the loop when the tab is hidden or the orb is offscreen.
- **Component API:** one reusable component, e.g. `components/PresenceOrb.tsx`, props `{ employeeId, state, analyser? | level? }`. Centralize the color map (reuse the persona colors already in the codebase; add a `lib/` config if cleaner).
- **Wire to real state:** `thinking` = request in flight · `talking` = TTS audio playing (text streaming until Track A) · `working` = an in-progress task exists for that employee.
- **Placement:** Atlas orb = the dashboard / AtlasBrief centerpiece (orb above, input below, orb reacts). Each employee's chat shows their orb reacting while streaming. Design to fit the mobile/PWA redesign (`prompts/mobile-pwa-prompt.md`) — they share the UI rework. App theme is LIGHT — make sure the orb reads well on light surfaces.

## REFINEMENT (June 6 review — the orb read as "smoke," fix the structure)
The first cut looked blurry/fuzzy/random because it's all atmosphere, no anatomy. Jarvis works because it has a stable geometry that stays constant while the energy moves inside it. Build that skeleton:
- **Stable architecture (constant), energy moves INSIDE it:** every orb has (1) a defined, higher-contrast **core** with a readable center (not a soft blob), (2) a clear **outer boundary / rim** so the orb has a crisp silhouette, and (3) a thin **status ring** around it. The fuzzy energy animates within these fixed elements. Structure constant + energy moving = reads as a *being*, not smoke.
- **Per-agent BEHAVIOR signature (motion, not just color)** — so they're distinguishable at 32px and for colorblind users, and personality does brand work color can't:
  - **Atlas** — slow & dense, deliberate (executive): low-frequency, heavy churn.
  - **Aria** — quick & darting, energetic (sales/hunting): fast, sharp flicks.
  - **Nova** — flowing & swirling (creative): smooth rotational/liquid swirl.
  - **Opus** — steady & rhythmic (operations): even, metronomic pulse.
- **Status ring maps to REAL activity** (this is the orb earning its keep, tied to the activity feed): idle = faint/still · thinking = ring shimmer · working = ring **fills with real task progress** · done = ring completes + green pulse · needs-owner = attention-color ring. Connect it to actual state, not a fake loop.
- **Restraint (critical):** subtle at rest; expressive ONLY on the agent you're focused on or that's actively working. Never 4 orbs pulsing/rotating at once — that reads as a screensaver / crypto landing page and tanks perceived professionalism. On the workforce grid, idle orbs breathe slowly; the active one is expressive. Restraint = "luxury OS," not "crypto."
- **Sequencing:** this is polish. The dashboard credibility bugs (`prompts/dashboard-credibility-pass-prompt.md`) come FIRST — a beautiful orb above broken numbers makes the broken numbers look worse by contrast. Orb premium pass after the numbers are trustworthy.

## Definition of done
`build` / `lint` / `tsc` all green. Orb works with NO API key. Renders all six states with the params above; **stable core+boundary+status-ring structure**; each of the 4 agents has a **distinct motion signature** (recognizable with color removed); status ring reflects real state/progress; restraint enforced (only the active/focused orb is expressive). Identity color always recognizable, audio-reactive seam in place. Commit + push, and log what shipped to `CHANGELOG.md`. Acceptance test (Mitri): each agent feels like a distinct *being* (you can tell Atlas from Aria by how it moves, not just its color), with a crisp structure — not a colored smoke cloud.
