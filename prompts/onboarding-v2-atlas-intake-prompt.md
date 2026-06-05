# Build Prompt — Onboarding v2: Atlas Runs the Intake (+ Atlas Front-Door UI)
*Handed off June 4, 2026. Decided by Mitri + CEO. This closes CEO-mandate failure point #1 ("it's just ChatGPT with a UI") and is NON-NEGOTIABLE before the first paying customer.*

## Why (read first)
The current onboarding is a 7-question form feeding the `companies` row. That's a business card, not a brain — Aria can't personalize outreach and Nova can't personalize content from seven form fields. The fix: **onboarding becomes the customer's first conversation with Atlas**, their Chief of Staff. He researches their website before asking anything, interviews them like a real CoS on day one, and writes everything to the memory layer — which is HOW every employee personalizes, and the moat compounding from minute one.

Mitri's design instincts driving this: Atlas does the talking; brand assets get captured (upload or pulled from the site); Atlas sits above the team in the UI with his own persistent input.

## Part A — The Atlas Intake (replaces the form)

### Flow
1. **Signup → `/onboarding` becomes a chat with Atlas** (reuse the existing chat UI components + `/api/chat` with `isChiefOfStaff: true`, plus an `intakeMode` flag — see Engineering).
2. **Website first, questions second.** Atlas's opening move: "Welcome. I'm Atlas, your Chief of Staff. What's your website? I'll do my homework before I ask you anything." Owner pastes URL → server-side research (Part C) → Atlas presents findings: *"Here's what I understand about your business — correct me where I'm wrong: [company, what you sell, who you serve, tone]."* Confirmation beats interrogation — this is the minute-one magic moment.
3. **Structured interview** for what the site can't tell him (keep it tight — 5–8 exchanges max, one question at a time, in his calm voice):
   - ICP: who's the ideal customer; who's NOT (disqualifiers)
   - Offer & pricing: what they sell, price points, the transformation it delivers
   - Proof points: real results, testimonials, differentiators (REAL only — Atlas never invents proof and says so if they have none yet)
   - Brand voice: how they talk (formal/casual, banned words/phrases)
   - Goals: the #1 business goal for the next 90 days
   - **Brand kit:** "Got a logo? Upload it here — or I can take the one from your site." + primary colors (offer the ones detected from the site) + words/claims never to use
4. **Every confirmed answer is written to the memory layer immediately** as typed entries (see schema) — not held in conversation state. If the session dies, nothing is lost.
5. **Completion:** when the required set exists (ICP + offer + voice + goal), Atlas closes: "That's everything I need. The team can work now. Here's where we start —" → marks onboarding complete → redirect to dashboard where his first Morning Brief is waiting (honest fresh-workspace version: what the team WILL do first, no fake progress).
6. **Skip is allowed** ("I'll finish later") but the dashboard then shows an honest nudge from Atlas: "My picture of your business is incomplete — X of 6 areas missing. 5 minutes finishes it." Never block the app; never let an empty brain be silent.

### Memory schema for intake (uses existing `memory_entries`)
Write with `type` values: `icp`, `offer`, `proof`, `voice`, `goal`, `brand-kit`, plus `process` for anything procedural. Title = short label, content = the full confirmed detail. These types become the personalization contract: Aria's and Nova's runtime context already injects memory — no changes needed on their side.

### Hard boundaries (CEO-decided — do not cross)
- **No logo CREATION.** Capture/upload/extract only. A customer with no logo gets a Nova task suggestion, not a design tool.
- **Honesty in research findings:** Atlas presents what was actually found; if the site scan fails or finds little, he says so and interviews instead. Never fabricate findings.
- **One question at a time.** A wall of questions is the form again, with extra steps.

## Part B — Atlas Front-Door UI
1. **Dashboard centerpiece = Atlas.** Top of the dashboard: his Morning Brief card (real data via the existing whole-board context; honest fresh-state version when empty) + his input box right there. The score/metrics move below it.
2. **The Ctrl+K command bar becomes Atlas's bar.** Default routing: anything typed goes to Atlas (who answers or routes to a teammate via `create_task` assignee). "Aria, ..." prefix still routes direct — that behavior stays.
3. **Direct employee chat STAYS untouched.** Atlas routes by default; he never gatekeeps. Employee detail pages keep their chat tabs exactly as today.
4. Atlas gets visual seniority, not separation: his card/avatar leads the workforce views (he's already in the DB roster; ordering + a "Chief of Staff" treatment is enough). Keep the Three Gaps rules: hierarchy by weight/size, intentional empty states, hover/press feedback on everything new.

## Part C — Engineering
1. **`/api/onboard/research`** (new, auth-gated): `{ url }` → uses the SAME Anthropic web_search pattern as `app/api/agent/run/route.ts` → returns structured findings `{ company_name, industry, what_they_sell, target_customers, tone_guess, proof_found[], logo_url_candidates[], color_candidates[] }`. Cap: ONE research call per onboarding (cost control — log it to `usage_log` like any run). Findings are fed into Atlas's intake context for confirmation — never written to memory unconfirmed.
2. **Intake mode in the chat prompt:** extend `lib/chat-prompt.mjs` with an `intakeMode` flag → appends an INTAKE RULES block (the flow above: website-first, one question at a time, write-on-confirm, the required set, the closing). Keep it in the shared module so `scripts/verify-chat-prompt.mjs` conventions hold.
3. **Intake tools:** reuse `remember_detail` (extend `kind`/type per schema above) + add `save_company_profile` (writes/updates the `companies` row fields the old form wrote — company_name, industry, target_customers, brand_tone, main_goal, competitors, employee_count) + `complete_onboarding` (sets completion only when the required set exists — server-verified, not model-asserted).
4. **Brand assets:** Supabase Storage bucket `brand-assets` (per-company path, RLS-scoped). Logo upload component in the intake chat; "take it from the site" downloads the chosen `logo_url_candidate` server-side. Colors + banned words → `memory_entries` type `brand-kit`.
5. **Old form:** delete the 7-question UI after the new flow verifies. The `companies` schema stays — same row, better author.

## Verification (required — completion is proven, not asked about)
Ship `scripts/verify-onboarding-v2.mjs` (follow the `verify-*.mjs` pattern):
1. Simulated intake conversation (live model): Atlas asks for the website first; presents findings as confirmable, not assertions; one question at a time (no multi-question walls); never fabricates a finding (feed it a fake/empty research result and check he says so).
2. Confirmed answers produce `memory_entries` rows with the correct `type` values; the required set (icp/offer/voice/goal) gates `complete_onboarding` — calling it early must fail server-side.
3. `brand-assets` bucket exists, RLS-scoped (anon = blocked); a test upload lands in the right per-company path.
4. `/api/onboard/research` is auth-gated, logs cost to `usage_log`, and enforces the one-call cap.
5. Dashboard renders the Atlas brief card with the honest fresh-workspace state (zero fake numbers — grep-proof it).
6. Ctrl+K routes plain text to Atlas; "Aria, ..." prefix still reaches Aria.

Then: **commit + push.** Aria's email channel (build #4) remains the top dev priority — this ships behind it, never instead of it.
