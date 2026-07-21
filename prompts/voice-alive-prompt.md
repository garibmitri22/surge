# Build: CRITICAL PATH — "Feel human / alive" (voices + living presence)

Read CLAUDE.md, MEMORY.md (see "🔥 CRITICAL PATH — FEEL HUMAN / ALIVE") first. This is the product's soul: it sells "AI employees that feel like real teammates," so this isn't polish. The dev shipped a placeholder using FREE browser TTS (Web Speech) — it sounds robotic, which is exactly what Mitri is rejecting. Replace it with real, distinct, human voices + a living visual presence.

Two parallel tracks. Track B (orb) needs no API key — start it immediately. Track A (voices) unblocks when the ElevenLabs key lands in env.

## Track A — Real distinct voices (ElevenLabs)
Replace the Web Speech SpeechSynthesis output with ElevenLabs TTS.
- **Per-employee distinct voice that MATCHES persona.** Pick 4 ElevenLabs library voices: Aria = sharp/quick/confident (female), Atlas = calm gravity/measured (male, lower), Nova = bright/creative/warm (female), Opus = precise/even/grounded (male). Put the voice_id map in `lib/pricing.mjs` or a new `lib/voices.mjs` so it's one config.
  - ⚠️ **USE PERMANENT VOICE LIBRARY VOICES ONLY — NOT the built-in "Default" voices.** ElevenLabs "Default" voices (incl. one named "Aria") EXPIRE Dec 31, 2026 and stop working. Pick from the community Voice Library (marked use-forever) so we never have to re-pick. Capture each voice_id from the library.
  - **Audition shortlist (researched June 6 — confirm by EAR, voice is subjective):** Aria → "Alexandra" (steady, clear, C-suite) or "Emily" (crisp business). Atlas → "Thomas" (smooth warm baritone, calm gravity) or "Chad" (deep, soothing). Nova → "Aisha" (warm, bright, confident) or another youthful-warm female. Opus → "Aaditya K" (even, confident baritone) or "Burt" (calm, grounded). These are starting points to search in the library, not final.
- **Server route** `app/api/tts/route.ts`: auth-gated, takes {text, employeeId}, calls ElevenLabs, streams/returns audio. Strip markdown/emoji before sending (already done for the placeholder — reuse).
- **Client:** the existing SpeakButton on completed assistant messages now hits /api/tts and plays the returned audio. Tap-to-play (browser autoplay blocks). Keep it on ChatPanel + AtlasBrief + IntakeChat (incl. Atlas's opening line = spoken intro).
- **METER IT (hours):** ElevenLabs charges per character — debit hours per spoken message via `lib/hours.mjs`. Internal/`is_internal` accounts bypass. Cache audio by hash(text+voice) so repeated text (e.g. replaying) doesn't re-charge. Voice is a TOGGLE (off by default or "speak briefs + key moments"), never autospeak every reply.
- Env: `ELEVENLABS_API_KEY` (Mitri adds to .env.local + Vercel). If key missing → fall back to the Web Speech placeholder gracefully (don't break).
- **PLAN / COMMERCIAL RIGHTS (researched June 6):** Free tier = audition only, NO commercial rights. A paid plan is legally required to ship voice to customers. Tiers: Starter $5/mo (30k chars ≈ ~30 min, commercial rights, the floor) · Creator $22/mo (100k chars, better models + concurrency; overage $0.30/1k chars). Recommendation: audition on FREE, then **Creator $22** as the starting paid tier when TTS goes live (Starter's 30k is too thin for 4 voices speaking briefs across the app). This per-char cost is exactly why we meter voice in hours. Mitri confirms tier with Cowork before paying.

## Track B — Living presence (the orb) — NO KEY NEEDED, START NOW
Atlas (and each employee in their chat) becomes an animated presence, not a static text box. **DO IT RIGHT (Mitri): premium technique, not a cheap CSS pulse.** No 3rd-party "orb" exists — the best ones (ChatGPT voice orb, Siri, Jarvis) are all custom; this is a craft/render problem, build it bespoke but with the real technique.
- **Tech bar = WebGL / shader-based** (Three.js + GLSL fragment shader) for a fluid, organic, glowing liquid-light orb. NOT flat CSS circles. Reference: ChatGPT voice-mode orb / Jarvis. Performant (rAF, GPU; pause offscreen/tab-hidden). If the dev can't hit this bar, flag it — we bring in a shader/Rive motion specialist rather than ship a weak pulse.
- **Audio-reactive (real, not faked):** Web Audio API AnalyserNode reads the ACTUAL ElevenLabs TTS output → drives orb amplitude/turbulence so it pulses and flows WITH the speech. (Until Track A voices land, react to text-stream cadence as a stand-in.)
- **STABLE IDENTITY + LIVING MODULATION (Mitri's refinement):** keep the NAME + each employee's SIGNATURE COLOR as the fixed identity (Atlas amber, Aria purple `#a78bfa`, Nova green `#34d399`, Opus blue `#60a5fa`) — always who-is-who at a glance. On top of that fixed base, cadence/emotion/STATE dynamically modulate the orb: **hue shift AND motion speed AND turbulence AND glow/brightness AND shape.** States: idle (slow calm breathing) · thinking (faster shimmer) · talking (flowing waveform from audio) · working (active churn) · done (green-pulse) · needs-owner (attention tone). Identity constant, life on top.
- **Placement:** Atlas orb = the dashboard/AtlasBrief centerpiece (replace the plain input-box framing — orb above, input below, orb reacts). Each employee's chat shows their orb reacting while streaming/speaking.
- **Wire to real state:** thinking = request in flight; talking = TTS audio playing (Track A — until then, while text streams); working = an in-progress task for that employee exists.
- Design this to fit the mobile/PWA redesign (`mobile-pwa-prompt.md`) — they share the UI rework.

## Track C — Dictation upgrade (after A/B)
The shipped mic uses Web Speech (okay but inaccurate). Upgrade to higher-quality dictation: **ElevenLabs Scribe (STT)** to keep it one vendor/key, OR OpenAI Whisper if preferred. Server route records audio → STT → text into composer. Cheap. Lower urgency than voices/orb.

## Definition of done
build/lint/tsc green. Track B works with no key. Track A: 4 distinct human voices, metered, cached, fallback-safe. Mitri's acceptance test: it sounds like four different real people and Atlas feels alive (moves + glows), not a robot in a box. Commit + push.
