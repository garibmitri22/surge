# Build: Friends' launch feedback — fixes + features (June 5/6)

Read CLAUDE.md, MEMORY.md, CEO.md first. Mitri sent surgehq.io to friends. Real signups happened and the product WORKED multi-tenant: Luna Cycle (gym/cycle) + EA Renovations Inc (construction) each onboarded with their own isolated leads (7 and 10). Data isolation verified perfect. Below is their feedback, prioritized.

## P0 — Embarrassing bug, fix first (trivial)
**Hardcoded "Mitri" everywhere.** Every user sees "Mitri" as their name because it's a literal string in 3 places:
- `app/dashboard/page.tsx:118` — greeting "{greeting}, Mitri."
- `app/briefing/page.tsx:94` — "Good morning, Mitri."
- `components/Sidebar.tsx:90` — hardcoded "Mitri" (and check the "Owner · CEO" role line near it)
Fix: pull the real signed-in user's name from Supabase auth (user.user_metadata.full_name, else the email's local part) + their company. Sidebar role can stay "Owner" generically or derive it. NO user should ever see "Mitri" unless they are Mitri. (Data was always isolated — this is display only — but it reads like a leak to users.)

## P0 — Mobile blocks real use (rolls into the mobile-pwa job)
- **Can't run tasks on phone**: the Run button is off-screen and the tasks page won't scroll to it. Friends literally could not run a task on mobile. Make /tasks fully scrollable + Run reachable at 390px.
- This is part of `prompts/mobile-pwa-prompt.md` (mobile pass + PWA) — treat that prompt as the umbrella; this is the specific must-pass case.

## P1 — Real feature requests from real users (high signal, do after mobile)
1. **Voice / speech input — requested by multiple friends, "ASAP".** Typing on a phone sucks. v1: browser Web Speech API speech-to-text on the chat/Atlas input (mic button → transcribes into the text field). TTS on replies is a fast follow. This also serves the "Jarvis feel" ask below. Scope v1 = mic-to-text input only; real-time voice later.
2. **Image upload on the chat input.** Construction friend (EA Renovations) didn't want to *describe* his business — he wanted to *show a photo*. Add an image/attach button next to the text input (chat + intake). Store to Supabase storage (brand-assets bucket pattern exists). Visual businesses (construction, med spa, gyms) are our ICP — this matters. Atlas/employees should be able to reference uploaded images.
3. **Onboarding is "brutal / boring."** Even as a conversation it drags. Trim it: fewer turns, let users skip/batch, make Atlas's questions feel alive not like a form (ties to the contextual-questioning fix already queued). Activation killer — every user hits it. Target: under ~5 minutes, feels like a sharp conversation, not an interrogation.
4. **"Jarvis feel" — get the personalities out.** Employees should feel alive and distinct. Combine: voice/TTS (above) + the persona voice-distinctness work (em-dash/style rules already queued) + maybe a short spoken intro per employee. This is a vibe/polish theme, not one ticket — but it's the soul of the product per Mitri.

## Positive — validated, lean in
**Friends LIKED the lead ranking/scoring system.** The 0–100 rubric with reasons is a differentiator that landed. Keep it prominent in the product and the pitch.

## Order
P0 name fix (minutes) → mobile-pwa job incl. tasks scroll (the gate) → voice input → image upload → onboarding trim → personality/Jarvis polish. Ship P0 + mobile before lifting the send-freeze.
