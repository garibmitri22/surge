# Surge — Project Memory

## What It Is
**Surge** is an AI Workforce Platform. Businesses hire AI employees instead of traditional hires.
- Mission: Build the operating system for AI workers
- A business owner logs in and manages a team of AI employees that work 24/7
- Pricing: **$299/month per AI employee**
- Goal: Get product-ready ASAP, built by Mitri for himself first, then sell to others

## The Pivot
Surge was previously an AI home improvement marketplace (Houston pools). That version is scrapped. The new direction is fully AI Workforce Platform.

## Tech Stack
- **Framework:** Next.js 16 (App Router) + TypeScript
- **Styling:** Tailwind CSS 4 + inline styles (light theme)
- **Backend/DB:** Supabase (PostgreSQL) — ✅ WIRED IN (Step 1 done June 3, see below)
- **Auth:** Supabase Auth — 🔨 IN PROGRESS (Step 2, see below)
- **Project folder:** `C:\Users\Stephanie\surge`
- **Dev server port:** 3001 (3000 is used by QC Pro)

## Design Language
- **LIGHT theme only** — `#f9fafb` background, white (`#ffffff`) cards, dark text (`#111827`). NOT dark. (The old "#08090d dark mode" note was wrong — do not reintroduce it.)
- Apple × Palantir × Tesla feel
- Accent color: `#6366f1` (indigo)
- Geist Sans + Geist Mono fonts
- Animated status dots, score rings, fade-in transitions
- CSS variables in `globals.css`

## What's Been Built (June 2026)

### Foundation ✅
- `lib/mockData.ts` — all mock data: employees, tasks, activity log, memory entries, dashboard stats
- `lib/company.ts` — company profile helpers (localStorage until Supabase)
- `app/globals.css` — light theme, CSS variables, animations
- `app/layout.tsx` — root layout using AppShell
- `components/AppShell.tsx` — hides sidebar on onboarding/landing pages
- `components/Sidebar.tsx` — nav with Dashboard / Workforce / Tasks / Memory / Settings + Hire CTA + onboarding gate
- `app/page.tsx` — redirects to /dashboard

### Pages ✅
- `app/onboarding/page.tsx` — 7-question interview: company name, industry, target customers, brand tone, goal, competitors, team size. Stores to localStorage. Redirects to dashboard on complete. Left panel shows progress steps. Animated transitions.
- `app/dashboard/page.tsx` — HQ dashboard: personalized greeting with company name, live ticker, Workforce Score + breakdown bars, 6 metric cards, active tasks quick view, workforce status panel (clickable), activity feed
- `app/workforce/page.tsx` — employee cards (Aria, Nova, Opus) with score rings, KPIs, status dots + "In Development" pipeline (Rex, Clara, Evan, Piper, Finn)
- `app/workforce/[id]/page.tsx` — full employee detail: header, KPIs, tabs (Tasks / Activity / Responsibilities)
- `app/tasks/page.tsx` — task list with stats, filter tabs, assign modal, click-to-cycle status
- `app/memory/page.tsx` — memory entries by type, expandable cards, add modal
- `app/settings/page.tsx` — company profile display, re-run onboarding button, plan info, danger zone

## Workforce Architecture Laws (Mitri, June 3 2026 — apply to EVERY build)
1. **No employee gets bottlenecked.** Every employee follows the same pattern — persona (Layer 1/2) + tool belt + loop + scoreboard — so `aria.md` is the template, never a special case. Adding employee #4, #10, #50 must never require rebuilding anything.
2. **Shared company brain.** All employees read the same memory layer (ICP, brand voice, SOPs, rapport). Learn once, everyone knows it.
3. **Handoffs are first-class.** Any employee can pass work to any other (Aria → Opus: "prep the onboarding docs for the meeting I booked"). Tasks can be assigned to ANY employee; handoffs show in the activity feed.
4. **Company cohesion is the end state.** Eventually the workforce operates as a coordinated company — employees seeing each other's relevant work, coordinating on shared goals, reporting as a team in the CEO briefing. Every data structure (tasks, conversations, activity, memory) must be multi-employee from day one so cohesion is additive, not a rewrite.

## AI Employees

> **Persona system (June 3, 2026):** Each AI employee gets a persona doc in `personas/` — Layer 1 = core identity (ships with product), Layer 2 = per-company context injected from the memory layer. These become runtime system prompts when real AI is wired in. **`personas/aria.md` is DONE** (written by Mitri + CEO) and is the template for Nova, Opus, and all future employees.
> **Aria operating spec (approved June 3, in aria.md):** one brain (Claude only — no GPT split), one memory (Supabase — Surge IS the CRM, `leads` table ours; external CRM sync = enterprise later), tool belt registry (v1: research_web, create_lead, draft_email approval-mode, log_activity, report; v2: send_email, book_meeting — direct APIs, Zapier edges only, Figma cut), standing daily loop + triggers + commanded work, results feed Workforce Score.
> **Lead Lifeline system (in aria.md):** law = no lead without next_action + next_action_at; heartbeat sweeps overdue actions; SLAs (reply within hours, day 3/7/14 cadence, 90-day recycle); stale leads in morning check-in + dashboard red flag.
> **Aria's voice:** living character — signature style, opinions earned from real data only, rapport continuity, stays the sales voice as other agents join.
> **Aria tradecraft (CEO additions June 3, in aria.md):** objection playbook (new-category objections + grows from real conversations), lead scoring rubric (0–100: ICP fit 40/pain 30/ability 20/reachability 10, reasons required), deliverability hygiene (domain warmup, caps, spam triggers, bounce limits — the silent killer), handoff briefs (auto one-pager per booked meeting), disqualification discipline, experimentation method (one variable, real samples).
> **Aria capability roadmap (in aria.md):** Phase 1 = written outreach (now). Phase 2 = voice calls — qualification/booking (trigger: Phase 1 books meetings consistently, not a date). Phase 3 = full-cycle closing on low-ticket deals. Engineering rule: channel-agnostic data model + one persona brain across all channels, so adding voice never requires a rebuild.

### Aria — Sales Representative
- Color: `#a78bfa` (purple)
- KPIs: Leads Found, Emails Sent, Replies, Meetings Booked, Pipeline Value
- Personality: Sharp, direct, persuasive — top-performing SDR

### Nova — Marketing Director
- Color: `#34d399` (green)
- KPIs: Monthly Traffic, Leads Generated, Content Published, Conversion Rate
- Personality: Creative, strategic, data-informed

### Opus — Operations Assistant
- Color: `#60a5fa` (blue)
- KPIs: Tasks Completed, Hours Saved, Projects Managed
- Personality: Precise, systematic, thorough

## Pipeline Employees (In Development)
Rex (Recruiter), Clara (Customer Service), Evan (Executive Assistant), Piper (Project Manager), Finn (Finance Manager)
- **Gap logged June 4 (validated by Mitri's own usage):** no brainstorm/ideas employee exists — Opus honestly flagged it when asked "who do I brainstorm with?" Original decision: pipeline card only, measure demand, don't build before revenue (90-day rule). Side note: Opus gave this honest answer with NO persona file yet — honesty guardrail holding.
- **⤴️ REVISED June 4 (Mitri, CEO concurs): the Strategist/Chief-of-Staff IS the next employee build.**
- **✅ NAMED & PERSONA WRITTEN June 4: ATLAS — Chief of Staff.** (Name: fits the elevated-noun family Aria/Nova/Opus; carries the whole map. "Sage" rejected — Sage Group accounting owns that word in our SMB market.) **`personas/atlas.md` is DONE** (CEO + Mitri) — Mitri's mandate: most important employee so far, backbone + leader of the team, modeled on the best CoS ever (Agrippa, Hamilton, Hopkins, Baker III, Sandberg/Shotwell), unique voice (calm gravity, morning brief, one challenge per conversation, zero ego), powerful memory (decision log / open-loop ledger / idea-to-work pipeline). His KPI: daily owner conversations. KEY ENGINEERING NOTE in the file: Atlas's chat context must see the WHOLE board (all employees' tasks, pipeline, KPIs, full memory) — more context than any other employee — plus create_task assignable to ANY employee. Dev build = atlas.md exists; needs: employees-table row (id 'atlas'), expanded context injection, roster/UI card. Does NOT displace Aria email channel as dev priority.
- **✅ June 4 (later): BOTH builds CODE-COMPLETE by dev** — usage limits + Atlas. `lib/chat-prompt.mjs` now has Chief-of-Staff mode: `isChiefOfStaff` ctx flag → WHOLE-BOARD VIEW block (all employees' open tasks, lead pipeline summary, per-employee activity snapshot), rule 6 (Morning Brief ritual, route via create_task `assignee`, memory `kind` tags decision/open-loop/idea). create_task now takes `assignee` (any employee); remember_detail takes `kind`. **VERIFICATION PENDING:** dev must run migrations + `verify-usage-limits.mjs` + `verify-atlas.mjs` green, then commit + push. Dashboard/Workforce render Atlas from DB automatically.
- **🎯 LANDING + PACKAGING DECISIONS (CEO, June 4): Atlas included in EVERY plan** (COGS ~$20-30/mo chat-only; he's the retention engine + organic upsell — routes work to not-yet-hired employees: "that's Nova's lane, want to hire her?"). Landing: team section → 2×2 grid with Atlas, positioning line "Your team comes with a Chief of Staff." Team plan story: $999 = FOUR employees ($250/employee) run by a Chief of Staff. Reason the rule changed: HQ Chat v1 + personas + memory + create_task now exist, so his marginal cost collapsed to a persona file + DB row (half-day) — his tool IS the conversation. Strategic role: the DAILY-touch retention employee (briefing is weekly, score is passive; he makes Surge a daily habit) + every brainstorm feeds the memory layer (moat compounds) + his ideas route into tasks for other employees (drives team usage → sells the $999 plan). HARD CONDITIONS: (1) runs on total company context (tasks/leads/KPIs/memory/roster) — generic advice = failure point #1; (2) ideas must become work ("hand this to Aria as a task?"); (3) does NOT touch the critical path — Aria's email channel stays the dev priority; Strategist is parallel (persona via aria.md template). OPEN: his name + exact lane before persona is written. His KPI: daily conversations with the owner.

### Additional Pages ✅
- `app/briefing/page.tsx` — Weekly CEO Briefing: score banner, accomplishments, attention items, planned work. Linked in sidebar.
- `app/landing/page.tsx` — Public marketing page at /landing: hero, employee showcase, how it works, FAQ, email CTA. No sidebar.
- `app/workforce/page.tsx` — Updated with Hire modal: role selector, $299/mo pricing, confirmation animation.

## ✅ Step 1 DONE — Supabase wired in (June 3, 2026)
Mock data replaced with a live Supabase database.
- **Supabase project:** ref `lnjvwddxytlpxukdnphp`, URL `https://lnjvwddxytlpxukdnphp.supabase.co`
- Publishable (anon) key in `.env.local` (NOT committed). Secret/service key + DB password NOT stored anywhere in repo.
- Built: `lib/supabase.ts` (client), `lib/data.ts` (all data access), `supabase/schema.sql` (tables: companies, employees, tasks, activity_log, memory_entries + seed data), `lib/company.ts` rewritten to use DB instead of localStorage.
- All pages (dashboard, workforce, workforce/[id], tasks, memory, settings, onboarding, briefing) now pull from `lib/data.ts`. `lib/mockData.ts` kept for TypeScript types only.
- ⚠️ **RLS is DISABLED on all tables** — must be locked down when Auth (Step 2) lands. Do not forget.
- Verified in repo by Cowork PM June 3. Final user check: task survives page refresh.

## ✅ Step 2 DONE & PROVEN — Auth + multi-tenant RLS lockdown (June 3, 2026)
- verify-auth.mjs → ALL CHECKS PASSED (migration applied, RLS blocks anon reads=0 rows + writes=401).
- Two-tenant isolation proven with real accounts: Tenant C sees ZERO of Tenant B's tasks/companies. "ISOLATION PROVEN."
- proxy.ts route protection live (Next 16 renamed middleware→proxy). Data layer scoped by company_id. mailer_autoconfirm flipped ON (email confirmation OFF for testing).
- ⚠️ TODO before public launch: re-enable "Confirm email".
- ✅ June 4: yesterday's sbp_ token REVOKED by Mitri. A new one issued to the dev for the v2 build window. **Token policy (June 4):** management tokens are build-time only (migrations/admin) — Aria's runtime never uses them (she runs on project URL + anon key + Anthropic key). Rule: new token per build session, REVOKE when that build's verification passes, shortest expiry available. Verified June 4: token not in repo, git history, or .env.local.
- ✅ June 4 resolved: ANTHROPIC_API_KEY was missing from .env.local because the old key was deleted during the token cleanup. Fix in motion: Mitri creates a new key (named "Surge", with billing credit) and adds it to .env.local HIMSELF (never pasted in chat — auto-flag risk), dev restarts + tests Aria. Production rule: key goes in host env vars at deploy, never in files or chat.
- Real accounts in system: garibmitri1@gmail.com, mitri.garib@yahoo.com. Seeded demo data may need claiming to main account if dashboard looks empty.

## (historical) Step 2 handoff notes
- Claude Code prompt handed off: @supabase/ssr cookie auth, middleware route protection, /login + /signup pages (light theme — app is light, not dark), sign out in sidebar/settings, `supabase/auth_migration.sql` (user_id on companies, company_id on tasks/activity_log/memory_entries, RLS ON for all tables, employees = shared read-only catalog, snippet to claim seeded rows), lib/data.ts + lib/company.ts scoped per company, empty states required.
- Mitri's dashboard task: turn OFF "Confirm email" in Supabase Auth settings (re-enable before public launch).
- **VERIFY:** signup→onboarding→dashboard flow works; signed-out users redirected; a SECOND account sees only its own empty workspace (= RLS proven).
- Then Step 3: onboarding interview feeds the memory layer (the moat).

## ✅ Step 3 BUILT — HQ Chat v1 LIVE (June 3, 2026) — pending Mitri's feel-test
Dev verified: chat tables + RLS passing (verify-chat.mjs), ANTHROPIC_API_KEY valid (claude-sonnet-4-6), /api/chat auth-gated, build green. Features live: streaming in-character chat on employee detail pages (Chat = default tab), real-data-only reporting (honest when empty), command→plan→approve→creates real task, rapport→memory entries (tag 'rapport'), persistence, Ctrl+K command bar with "Aria, ..." routing. v1 scope: she plans + creates tasks, does NOT execute research/outreach yet (HQ Chat v2). NOTE: Nova/Opus have NO persona files yet — they run on DB role/personality only; writing nova.md + opus.md (using aria.md as template) is a cheap high-value next task. Mitri's Anthropic key in .env.local (gitignored).

## 📐 (original design) HQ Chat: "Talk to your team" (June 3, 2026)
The core product feature. Decided by Mitri + CEO:
- **Two doors:** global command bar docked on every page (Ctrl+K, "Aria, ...") + full chat tab on each employee detail page.
- **Persistent conversations** in Supabase (`conversations`, `messages` — channel-agnostic per Aria roadmap rule).
- **Brain:** Claude API + persona Layer 1/2 (`personas/*.md`) + memory layer + LIVE task/KPI data. Hard rule: progress reports come from real DB data — never invented.
- **Rapport memory:** personal details the owner shares are stored as memory entries (tagged 'rapport') and recalled in later chats — humanizes employees, deepens the moat.
- **Commands → tasks:** a directive (e.g. "rank and qualify top 100 Houston med spas, book sales calls, report back") → she proposes a plan → owner approves → structured task on Tasks board → progress in activity feed → report delivered in chat.
- **Proactive engine:** morning check-in, decision-needed alerts, end-of-day report.
- **Approval mode guardrail:** external actions (sending email, booking) require owner approval until flipped to autonomous per-employee.
- **Phases:** v1 chat+tasks+real-data reports (build right after Step 2 auth verifies) → v2 first real action: live web research/lead qualification → v3 email+calendar integrations for sending/booking.

## What's NOT Built Yet
- HQ Chat v2 — Aria EXECUTES (live web research, lead qualification, draft outreach w/ approval) + `leads` table + Lead Lifeline system
- Persona files for Nova + Opus (use aria.md as template — cheap, high value)
- Weekly CEO briefing email (Monday automation)
- Billing / payments (Stripe)
- Mobile pass on landing page (dev offered, not run yet)
- Domain + real email (Contact sales mailto → garibmitri1@gmail.com for now)
- Before public launch: re-enable "Confirm email" in Supabase

## Session Log — June 3, 2026 (one day, foundation → real product)
✅ Supabase wired (Step 1) → ✅ Auth + multi-tenant RLS proven (Step 2) → ✅ HQ Chat v1 live (Step 3, pending Mitri feel-test: voice / command-loop / rapport) → ✅ v0 landing integrated honestly → ✅ aria.md complete (identity, operating spec, Lead Lifeline, voice, tradecraft, roadmap) → ✅ Workforce Architecture Laws → ✅ daily 8am meeting scheduled → ✅ CEO.md upgraded (skill stack + verify-yourself rule). NEXT SESSION OPENS WITH: Mitri's HQ Chat feel-test results → tune aria.md if needed → then HQ Chat v2 (her first real action).

## Session Log — June 4, 2026
✅ **HQ Chat feel-test PASSED** (Mitri ran it with Aria): voice is sharp and honest, zero fabricated capability claims, plan→approve→task loop worked, smart vertical reasoning. Verdict: do NOT tune aria.md — go straight to v2.
⚠️ **Feel-test exposed the v1/v2 gap:** Aria created an approved prospecting task and promised "I'll check back in when I have the ranked list" — but v1 has no execution engine. The task sits idle; trust decays daily. **HQ Chat v2 is now the single priority.**
🎯 **GTM DECISION (Mitri, June 4): Surge is its own first customer.** Aria's job is to sell Surge. ICP: **med spas (first), real estate teams, gyms/fitness studios** — owner-operated, 1–20 employees, obvious follow-up/hiring pain. Geography: **North Houston up to Conroe** (tight region, fast iteration). Old "B2B SaaS" ICP framing superseded for outreach v1.
📋 Live approved task on Aria's board: identify + score top 50 prospects across the 3 verticals, rank by pain signals, draft per-vertical cold email sequences, stage for send. v2 must execute exactly this.
🚧 Sending still blocked on domain + real email (deliverability hygiene per aria.md) — v2 = research + score + drafts (approval mode), NOT sending.
🎬 **Nova scope decision (Mitri, June 4): Nova = FULL-STACK marketing** — written content + social media + video. Phase 1 (now): posts, scripts, production-ready UGC briefs in chat. Phase 2: social publishing integration (approval mode). Phase 3: AI video generation via API — **Higgsfield designated candidate tool** ($15–129/mo credit plans, API on higher tiers; video models burn 6–70 credits each — evaluate unit economics before wiring). No integration built now — roadmap text in nova.md only.
📤 Two prompts handed off June 4: `prompts/hq-chat-v2-prompt.md` (critical path) + `prompts/personas-nova-opus-prompt.md` (independent).
🔨 **June 4 PM repo check (Cowork CEO, verified directly): BOTH builds are code-complete in the repo** — v2: `supabase/leads_migration.sql` (leads + lead_drafts + next_action law), `app/api/agent/run/route.ts` (execution engine + tool belt), `app/leads/page.tsx`, `lib/leads.ts`, `scripts/verify-leads.mjs`. Personas: `personas/nova.md` + `personas/opus.md` exist. **NOT YET VERIFIED** — blocked because ANTHROPIC_API_KEY is still missing from .env.local (Mitri adding new key himself via Notepad). Verification gate: dev runs verify-leads.mjs + Aria's real med spa run (lead count, top 5 + scores) + personas chat test.
🐛 **Fix queued (June 4): employees can't see their teammates.** Aria told Mitri she has "no visibility into who else has been built" — violates Architecture Laws #3/#4 (handoffs/cohesion). Fix: inject live employee roster (name, role, lane, status) from the employees DB table into every chat's system context. Handed to dev. ✅ Counterpoint proven same exchange: shared memory layer WORKS — Aria cited the strategist gap logged via Opus.
⚠️ **GIT RISK (June 4): repo has ONE commit ever** ("Initial Surge project setup") — all June 3–4 work (auth, chat, v2, personas) is uncommitted. Dev must commit everything as part of verification. Going forward: commit at every verified milestone.
🔑 Token cleanup done: old Anthropic keys to be deleted (one key per purpose policy); today's sbp_ token revoked AFTER v2 verification passes.
🐛 **Fixed June 4 (Cowork, verified live): HQ Chat falsely claimed "research_web isn't connected — talk to Mitri."** Root cause: chat prompt let Aria frame the v1 chat scope as a missing product integration. Fix: HARD RULES 3+5 rewritten — directives route to create_task + "hit Run on the Tasks page"; claiming a missing/not-connected integration is banned. Verified live against claude-sonnet-4-6 (plan→approve→create_task→points to Run, forbidden-phrase scan clean). **Refactor:** prompt + chat tools extracted to `lib/chat-prompt.mjs`, imported by BOTH `app/api/chat/route.ts` and `scripts/verify-chat-prompt.mjs` — test can no longer drift from production. Note: stray `app/api/chat/route.ts.clean` may exist (sandbox couldn't delete) — safe to delete.
🔚 **Session ended June 4 with ANTHROPIC_API_KEY added by Mitri; execution test NOT yet confirmed.** NEXT SESSION OPENS WITH: results of Aria's first real run — the 7-step test script given to Mitri (liveness → "start working the med spa list" → spot-check 3 leads are REAL businesses → score reasons → draft quality → report counts match /leads → Nova social+UGC test). Then: dev commits everything to git, sbp_ token revoked, roster-visibility fix verified. If the run produced real leads, Surge did its first real day of work — next milestone after that is domain + email setup so approved drafts can actually send.

## 💰 PRICING & UNIT ECONOMICS — CEO meeting with Mitri, June 4 2026
**COGS verified (live API pricing June 2026):** Sonnet 4.6 $3/$15 per M tokens; heavy Aria task run ≈ $1.50–2.00 (incl. ~30 web searches); chat ≈ pennies (caching already in code). Typical customer ≈ $90/mo COGS → ~70% margin at $299. UNCAPPED 24/7 usage = $6–10K/mo COGS per employee → one customer wipes out thirty. Nova: text/images trivial ($20–50/mo); video is the only real cost — social clips $1–1.50 (fast tiers: Sora 2 $1/clip, Veo Fast/Runway ~$0.15/sec), premium 4K $7.50/clip; hidden killer = regenerations (real cost per ACCEPTED video is 3–5x list). Higgsfield gate confirmed correct: video works metered on fast tiers, breaks us unlimited.
**Market check:** competitors charge far more per AI employee — Artisan $600 entry / $2,400–7,200/mo, 11x $5–10K/mo annual. $299 is underpriced vs category; their buyers are funded B2B teams though, not med spas — our ICP ceiling is lower.
**DECISIONS (Mitri, June 4):**
1. **Restructure pricing: "Hire the Team" flagship at $899–999/mo** (Aria+Nova+Opus, the default on the pricing page); single employee raised to **$399** as entry door; Enterprise custom. At $999/team, $1M ARR = 84 customers (vs 280 at $299). Treat as hypothesis — first 10 prospects are the pricing experiment.
2. **Usage limits are PERMANENT at every price** (not a stopgap): every employee gets a "workday" — 1 autonomous daily cycle + ~60 task runs/mo; Nova video metered in deliverables (8/mo, regens count). Limits invisible to normal users; on hitting cap the employee upsells in character ("add capacity or hire another teammate?").
3. **Build before first paying customer:** usage counter on /api/agent/run (enforcement) + cost telemetry from day one (tokens + $ per run/employee/company) — future pricing set from real data.
4. Cost discipline: route research/scoring grunt work to Haiku ($1/$5), batch overnight sweeps (50% off), default video to fast tiers (4K = vanity for social).
**📊 THE PLAN (Mitri approved June 4): 20 team customers = the model.** 20 × $999 = $19,980/mo revenue; worst case (ALL maxing limits) COGS ~$5,800 + ~$800 fees/infra → **~$13.4K/mo (~$160K/yr) profit solo**, ~67–70% margin even redlined. Realistic usage → ~$15.5K/mo. Dev contractor is the main cost not in the model (takes it to ~$100–120K/yr). Customers at limit = best customers (max value, renew, refer, upgrade). 20 team customers ≈ wedge math at 2% conversion — reachable from North Houston alone.
**📤 Build prompt handed off: `prompts/usage-limits-telemetry-prompt.md`** — usage quotas on /api/agent/run (workday: 1 daily cycle + 60 runs/mo/employee, config-driven), in-character capacity upsell message, usage_log cost telemetry, Haiku routing, pricing page restructure ($999 team / $399 single), verify-usage-limits.mjs + git commit gate. Ships BEFORE first paying customer.

🐛 **FLAGGED June 4 (CEO, must fix before briefing email ships): `app/briefing/page.tsx` is hardcoded MOCK data** — fake wins ("Booked 28 discovery calls", "Published 31 pieces", "Saved 47 hours") rendered as real. Violates the never-invent-metrics rule on the retention-anchor page itself. Fix: highlights/attention items from real activity_log + KPIs, honest empty states when no data. Not urgent today; HARD GATE before Weekly CEO Briefing email automation. (Also June 4: stray `page_clean.tsx` deleted by Cowork, deletion captured in dev commit accaea4 — resolved.)

## 🧭 NORTH STAR — Agent maturity ladder (Mitri + CEO, June 4)
Levels: 1 talks → 2 acts in chat (tools) → 3 executes multi-step work on command → **4 proactive + reactive (acts on time/event/state triggers without being told)**. **Surge today = Level 3** (Aria's run engine, click-to-run only). **Level 4 = the goal, and it's already on the roadmap as: Lead Lifeline heartbeat + Atlas automated morning brief + Aria standing daily cycle (proactive) + email reply handling (reactive).** It's a scheduler + triggers on the existing engine, not new tech. Disciplines: usage limits ship first (autonomy on a clock = unbounded bill without metering — the "1 daily cycle" quota IS Level 4's budget); approval mode still gates outward actions until owner flips an employee to autonomous.

## 🧹 LANDING HONESTY PASS #2 (CEO, June 4 — after dev shipped Atlas/pricing update)
Dev's structural update PASSED review: 2×2 team grid w/ Atlas ("Included in every plan" badge, amber), headline "Your team comes with a Chief of Staff" + "No competitor ships a team that manages itself", $999 highlighted w/ "$250 each" math, limits framed as "full workday". **BUT fabricated performance stats survived the June 3 honesty pass and were REMOVED by CEO:** fake "847 leads qualified / 156 meetings booked / 34% response / 2,341 tasks / 99.7% accuracy" → replaced with capability stats in Atlas-card style ("Prospecting: Daily", "Every lead scored: 0–100", "Tasks dropped: 0"). FAQ + card copy aligned to approval-mode truth (Aria "you approve before anything sends"; removed Opus schedules/email + "direct integrations" claims; "How it works" step 1 now team-aware). RULE REINFORCED: capability claims yes, invented results never — Atlas's card was the model. ⚠️ Dependency noted: team plan promises "Real-time Workforce Performance Score" — score must be REAL before Stripe billing ships (build order items 6→8). Mobile device pass still not done.

## Build Order (Next Steps) — UPDATED June 4 (Mitri approved; supersedes June 3 order)
**THE STANDING QUALITY BAR (Mitri, June 4): whoever spends $1K of hard-earned cash gets four employees at their A-game, each with a DISTINCT built-in voice — Aria sharp/direct, Nova creative/strategic, Opus precise/systematic, Atlas calm gravity. Any employee that sounds generic or interchangeable fails the bar. Every build and persona change is measured against this.**

1. **Close out the pending verifications** — dev runs migrations, `verify-usage-limits.mjs` + `verify-atlas.mjs` green, landing 2×2 with Atlas on every plan ($999 team / $399 single), commit + PUSH to origin (push still unconfirmed — disk-loss risk open until then).
2. **Aria's first real run confirmed** — the 7-step test (liveness → med spa run → spot-check 3 REAL businesses → score reasons → draft quality → counts match /leads → Nova test). The milestone between us and everything else.
3. ✅ **A-game voice pass DONE (CEO, June 4)** — verdict: dev's nova.md + opus.md already MEET the standard (real reference DNA — Schwartz/Halbert for Nova, Deming/Gawande/Ohno for Opus — distinct voices, tradecraft, guardrails, own equivalent systems). Targeted fixes applied, not a rewrite: (a) **CRITICAL — all personas still sold $299/Basic/Growth pricing; Aria would have quoted the wrong price to real prospects.** All four Layer 2 blocks updated to $999 team (run by Atlas, included every plan) / $399 single / Enterprise custom, anchored vs $50K human. (b) Atlas woven into Nova+Opus (voice distinctness lines, Opus's "whole board" lane collision fixed: Atlas sets priorities + routes, Opus runs execution mechanics). REMAINING: Mitri's feel-test of all four voices — do they sound like four different people? Mitri is the judge. NOTE: Mitri's framing June 4 — it's not about the $1K, it's changing lives + businesses that need us; mission = every employee a real Level-4 agent with real feel.
4. **Domain + email channel** — buy domain, wire Resend/Gmail API, SPF/DKIM/DMARC, warmup schedule per aria.md deliverability rules. Unlocks: sending (revenue), replies (reactive triggers). THE revenue build.
5. **Onboarding v2 — "Atlas runs the intake"** — 📤 **build prompt handed off June 4: `prompts/onboarding-v2-atlas-intake-prompt.md`** (intake flow + brand kit + Atlas front-door UI + /api/onboard/research + verify-onboarding-v2.mjs; ships BEHIND email channel, never instead). Design (Mitri + CEO, June 4; replaces the 7-question form; NON-NEGOTIABLE before charging — CEO-mandate failure point #1): signup → conversation with Atlas, not a form. Flow: (a) ask for website URL → system researches it with the EXISTING web research engine → Atlas opens "I read your site — here's what I understand, correct me"; (b) structured interview writes typed entries to the memory layer (ICP, brand voice, offer, proof points, differentiators, goals) — this is HOW all employees personalize; (c) **brand kit capture** in the same conversation: logo upload OR "I'll grab it from your site" + colors + banned words → Supabase storage + memory. PUSHBACK LOGGED: logo CREATION rejected (feature-factory trap, doesn't move outreach; a missing logo becomes a Nova brief, not a product feature). Note: media = Nova's lane (not Opus).
6. **Atlas front-door UI (Mitri + CEO, June 4):** Atlas is not one card among four — dashboard centerpiece = his Morning Brief, plus his own persistent input docked on every page (the existing Ctrl+K command bar becomes Atlas's bar). Default: talk to the company through Atlas; he routes. HARD BOUNDARY: direct chat with every employee STAYS — Atlas never gatekeeps.
7. **Level 4 proactive layer** — scheduled heartbeat: Aria's standing daily cycle + Lead Lifeline overdue sweep + Atlas automated Morning Brief (his v2 spec). The "work happened while you slept" moment — the real $1K justification.
8. **Honest retention surfaces** — briefing page on real activity_log/KPIs + honest empty states (flagged bug), real Workforce Performance Score (the One Number is currently mock — and the team plan now advertises it, so it must be real before billing).
9. **Opus's first real action: handoff briefs** (auto one-pager per booked meeting — the "my AI team sent me this" moment) + **Nova's execution runner** (content deliverables + approval flow, same pattern as Aria's).
10. **Stripe billing** — $999 team / $399 single. Then: first paying customer.

## Design Direction (June 3, 2026)
- Current landing/app look is too basic for the vision. Decision: redesign via **v0.app (free tier)** — outputs Next.js+Tailwind (our stack), Mitri iterates visually himself, dev integrates the winner. Adobe XD rejected (discontinued/maintenance mode, mockup-only). Lovable = backup, Figma Make = exploration only.
- CEO wrote the v0 design brief (light theme, indigo, Apple × Palantir × Tesla, employee cards, score section, $299 pricing vs $50K human framing). Mitri runs v0 in parallel — does NOT touch the dev critical path (auth → HQ Chat).
- ✅ **June 3: v0 landing INTEGRATED & VERIFIED by dev** — `app/landing/page.tsx` (single-file v0 design), shadcn Button + cn util recreated, globals.css tokens appended additively (internal pages untouched), framer-motion/lucide/cva/clsx/tailwind-merge/radix-slot installed. Build green, /landing public + 200, Geist via next/font (zero serif), zero fabricated claims (grep-proven). All CTAs → /signup; Contact sales → mailto placeholder `CONTACT_SALES_MAILTO` constant (currently hello@surge.app — NOT a real address yet, swap when domain/email exists). Mobile = v0's responsive classes as-approved, no device pass done yet.
- **June 3: Mitri APPROVED the v0 landing design** (8 sections: hero / team cards / how-it-works / score ring / coming-soon / pricing w/ dark Growth card / FAQ / final CTA). CEO review required 4 fixes before ship: Geist Sans everywhere (was rendering serif), indigo #6366f1 primary CTAs (was all black), HONESTY PASS (remove fake "2,400+ businesses", fake "SOC 2 certified", Aria "closes deals"→"books qualified meetings" — fabricated trust claims NEVER ship), raw &apos; bug. Integration prompt handed to dev: v0 ZIP → replaces /landing, CTAs → /signup, /landing stays public in proxy.ts.

## Recurring
- **Daily meeting scheduled — 8:00 AM every day** (Cowork scheduled task `surge-daily-meeting`): reads CLAUDE.md/MEMORY.md/CEO.md, delivers status → working → at-risk → next 3 moves.

## Business Model
- $299/month per AI employee
- Basic: 1 employee | Growth: 3 employees | Enterprise: unlimited + custom training
- Goal: First paying customer ASAP

## Key Files
- Mock data: `lib/mockData.ts`
- Global styles + CSS vars: `app/globals.css`
- Sidebar: `components/Sidebar.tsx`
- All pages: `app/dashboard/`, `app/workforce/`, `app/workforce/[id]/`, `app/tasks/`, `app/memory/`
