# Phase 3 — True AI voice calls (DOCUMENT ONLY — do not build yet)

Build AFTER Phase 1 (inbound capture + SMS speed-to-lead + owner-bridge call) proves out
with real leads. This is a separate stack from the in-app ElevenLabs voice (Track A) and
from the Phase 1 owner-bridge call (which connects two humans, no AI on the line).

## What it is
Aria actually speaks on the phone with the consumer: answers inbound calls and/or places
consented outbound calls, holds a real-time spoken conversation, qualifies, and books.

## Architecture (sketch)
- **Telephony:** Twilio Programmable Voice **Media Streams** (bidirectional audio over a
  WebSocket) — not TwiML `<Say>`. A `<Connect><Stream>` hands the call's audio to our
  socket endpoint.
- **In:** caller audio → streaming **speech-to-text** (ElevenLabs Scribe, or Deepgram/
  Whisper-streaming) → partial transcripts.
- **Brain:** the transcript drives the LLM turn (reuse Aria's persona + company brain;
  a latency-tuned model). Barge-in handling (stop speaking when the caller talks).
- **Out:** LLM text → **ElevenLabs TTS** (streaming) → audio frames back over the stream.
- **Latency target:** sub-second round-trip (STT partial → LLM → TTS first byte). This is
  the hard engineering bar; budget aggressively (streaming everything, no full-utterance
  waits).

## Hard requirements (non-negotiable)
- **Mandatory AI disclosure at call start** — the first thing Aria says is that she's an
  AI assistant for {company}. Legally required in a growing list of states; do it
  everywhere. Log the disclosure.
- **Consent still governs** — same consent spine as Phase 1 (`lib/inbound.mjs`): no
  outbound AI call without a stored call-consent record; honor opt-outs; respect quiet
  hours. `is_internal` never bypasses consent.
- **Recording consent** — if calls are recorded, two-party-consent states require notice;
  capture it.
- **Metering** — a live AI voice call is the most expensive action (STT + LLM + TTS per
  minute). Meter per-minute in hours (`lib/pricing.mjs` — add a `voice_call_minute` price),
  debit actual minutes, never on a failed/abandoned call.
- **Human handoff** — at any point ("let me get someone", low confidence, escalation
  triggers) bridge to the owner (reuse the Phase 1 `/api/voice/connect` bridge).

## Why it waits
Phase 1 (text + owner-bridge) proves the inbound funnel and consent plumbing with far less
risk and cost. Turn on AI voice only when Phase 1 is booking conversations consistently —
proof, not calendar (same phase-gate discipline as Nova's publishing/video).
