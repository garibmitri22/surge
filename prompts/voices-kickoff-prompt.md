# Kickoff: Track A — Real distinct voices (ElevenLabs TTS)

First read `CLAUDE.md`, `MEMORY.md` (see "🔥 CRITICAL PATH — FEEL HUMAN / ALIVE"), and the full spec `prompts/voice-alive-prompt.md`. **Build Track A only.** Track B (the orb) is a separate task.

## Prerequisites (must be in place before this runs)
- `ELEVENLABS_API_KEY` set in `.env.local` and in Vercel env.
- Four voice IDs chosen from the **permanent Voice Library** (NOT the built-in "Default" voices — those expire Dec 31, 2026). Fill these in before starting:
  - Aria (sharp / quick / confident, female): `<voice_id>`
  - Atlas (calm gravity / measured, male, lower): `<voice_id>`
  - Nova (bright / creative / warm, female): `<voice_id>`
  - Opus (precise / even / grounded, male): `<voice_id>`

## What to build
Replace the placeholder Web Speech `SpeechSynthesis` TTS (`components/SpeakButton.tsx`) with real ElevenLabs voices — four distinct, human, persona-matched voices, metered in hours.

## Hard requirements
- **Voice config** — put the `{ employeeId -> voice_id }` map in one place (`lib/voices.mjs`, or extend `lib/pricing.mjs`). No voice IDs hardcoded in components.
- **Server route `app/api/tts/route.ts`** — auth-gated. Takes `{ text, employeeId }`, looks up the voice_id, calls ElevenLabs, returns/streams the audio. Strip markdown/emoji before sending (reuse the cleanup already written for the placeholder). Pick the model deliberately (Flash/Turbo for latency + lower per-char cost where quality holds).
- **Meter it (hours)** — ElevenLabs bills per character, so debit hours per spoken message via `lib/hours.mjs`. `is_internal` accounts bypass (Mitri). Never charge for failures. Voice is a **toggle** — off by default, or "speak briefs + key moments only" — never autospeak every reply.
- **Cache** — key audio by `hash(text + voice_id)` so replays / repeated text don't re-call ElevenLabs and don't re-charge hours.
- **Client** — the existing `SpeakButton` on completed assistant messages now hits `/api/tts` and plays the returned audio. Tap-to-play (browser autoplay is blocked). Keep it on `ChatPanel`, `AtlasBrief`, and `IntakeChat` (incl. Atlas's opening line = spoken intro).
- **Graceful fallback** — if `ELEVENLABS_API_KEY` is missing or the call fails, fall back to the existing Web Speech placeholder. Never break the UI.
- **Hand to the orb** — expose the playing audio so Track B's `PresenceOrb` can attach a Web Audio `AnalyserNode` and react to the real voice (the orb already has the seam). Coordinate the shape with the orb component.

## Definition of done
`build` / `lint` / `tsc` all green. Four clearly different human voices, one per employee. Metered + cached + `is_internal` bypass + toggle + graceful fallback all working. Audio exposed for the orb's analyser. Commit + push, and log what shipped to `CHANGELOG.md`. Acceptance test (Mitri): it sounds like four different real people, not one robot.
