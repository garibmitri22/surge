# Claude Code Prompt — HQ Chat v2: Aria Executes (Leads + Real Research)

Paste everything below into Claude Code from `C:\Users\Stephanie\surge`.

---

You are building **HQ Chat v2** for Surge (Next.js 16 App Router + TypeScript + Tailwind 4, light theme, Supabase backend, dev port 3001). Read `CLAUDE.md`, `MEMORY.md`, and `personas/aria.md` first — aria.md is the operating spec and is binding.

## Context
HQ Chat v1 is live: streaming in-character chat (`/api/chat`, claude-sonnet-4-6), command→plan→approve→creates a real task, rapport memory, Ctrl+K bar. v1's limit: Aria plans but cannot execute. There is now a real approved task on her board: **identify and score the top 50 prospects (med spas first, then real estate teams, gyms/fitness studios) in North Houston up to Conroe, rank by pain signals, and draft per-vertical cold email sequences.** v2 makes her actually do it.

## Hard rules (from aria.md + CEO mandate)
1. **Real data only.** Every lead must be a real business found via live web research. Zero fabricated leads, zero invented details. If research finds only 12 qualified leads, report 12 honestly.
2. **Approval mode.** Aria NEVER sends anything. Emails are drafts pending owner approval. No external side effects beyond web reads.
3. **Lead Lifeline law:** no lead row may exist without `next_action` + `next_action_at`. Enforce at DB level (NOT NULL).
4. **Channel-agnostic + multi-tenant:** every table scoped by `company_id` with RLS (follow the proven Step 2 pattern). Data model must not assume email-only (voice comes later).
5. Surge IS the CRM — leads live in our DB, no external CRM.

## Build

### 1. `leads` table (`supabase/leads_migration.sql`)
Columns: `id`, `company_id` (RLS scope), `business_name`, `vertical` (`med_spa` | `real_estate` | `gym` | `other`), `location`, `website`, `contact_name` (nullable), `contact_role` (nullable), `email` (nullable), `phone` (nullable), `source_url` (where found — required, honesty audit trail), `score` int 0–100, `score_reasons` jsonb (rubric breakdown: icp_fit /40, pain /30, ability /20, reachability /10 — each with a one-line reason, per aria.md), `status` (`new` | `qualified` | `drafted` | `contacted` | `replied` | `meeting` | `disqualified` | `recycled`), `disqualify_reason` (nullable), `next_action` NOT NULL, `next_action_at` timestamptz NOT NULL, `notes`, timestamps. Plus `lead_drafts` table: `id`, `lead_id`, `company_id`, `channel` (`email`), `sequence_step` int, `subject`, `body`, `approval_status` (`pending` | `approved` | `rejected`), timestamps. RLS ON for both, same policy pattern as tasks.

### 2. Aria's tool belt (`lib/tools/`)
Implement as tools in the Claude API call (tool use), per aria.md v1 belt:
- `research_web` — live web search + page fetch (use Anthropic's web search tool on the API if available on this key; otherwise a search API the dev chooses — note the choice). Used to find real businesses, owner names, reviews/job posts (pain signals).
- `create_lead` — inserts a lead row (validates Lifeline law + score_reasons present).
- `draft_email` — writes a draft into `lead_drafts` (approval_status=pending). Subject + body, personalized, per-vertical angle. Pitch = Surge ($299/mo AI employee vs $50K human; Aria "books qualified meetings" — never "closes deals"; NO fabricated trust claims, no fake customer counts).
- `log_activity` — activity_log entries as she works.
- `report` — posts a chat message summarizing results with real counts from the DB.

### 3. Execution engine
A server-side run loop (API route, e.g. `/api/agent/run`, auth-gated) that takes an approved task and lets Aria work it agentically: research → score → create leads → draft for top targets → log activity → final report message in the task's conversation. Constraints: cap iterations/tokens per run (no runaways), idempotent (re-runs don't duplicate leads — dedupe on business_name+location), task status moves in_progress → done, partial progress saved so a run can resume. Trigger v1: a "Run" button on the task (owner-initiated) — no cron yet.

### 4. UI (minimal, light theme, follow the Three Gaps — typography hierarchy, intentional empty states, hover/press states)
- `/leads` page in sidebar: table ranked by score — name, vertical, location, score (with reasons on expand), status, next_action + next_action_at; red highlight when next_action_at is overdue (Lead Lifeline). Filter by vertical/status.
- Draft review: on a lead (or drafts tab), show pending drafts with Approve / Reject buttons (approval flips status only — sending does not exist yet, say so in the UI honestly: "Sending goes live when email is connected").
- Dashboard: small "Pipeline" stat (lead count + overdue-action red flag).
- Activity feed shows her research/lead/draft events live.

### 5. Verification (mandatory — follow the verify-yourself pattern)
- `scripts/verify-leads.mjs`: migration applied, RLS blocks anon reads/writes on `leads` + `lead_drafts`, Lifeline NOT NULL constraints enforced (insert without next_action must fail).
- A real run: execute Aria's live prospecting task for MED SPAS only (first batch, ≥10 real leads). Spot-check 3 leads' `source_url`s resolve to real businesses in the North Houston→Conroe area. Confirm score_reasons present on all, drafts created for top 5, report message posted with accurate counts.
- Build green, all existing pages unaffected.
- **Report back:** what was built, verify-leads.mjs output, the real-run results (lead count, top 5 names + scores), any deviations or choices made (e.g. which search API).

## Out of scope (do NOT build)
Email sending, calendar/booking, voice, cron/heartbeat sweeps, external CRM sync, Stripe. Drafts stop at approval_status.
