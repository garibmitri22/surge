# Kickoff: Nova's Studio (her surface — content engine, P1 only)

First read `MEMORY.md` ("AI Employees" → Nova; "Workforce Architecture Laws") and `personas/nova.md`. Nova is the Marketing Director (`#34d399` green) — full-stack marketing. Today she has no surface; Aria has `/leads`, Atlas has the dashboard, Nova has nothing. Give her a Studio. **Build P1 only.**

## Scope discipline
- **P1 (this task):** generate marketing content from the company brain — social posts, short-form video scripts, UGC briefs, captions. Draft → owner approve/edit. NOTHING is published anywhere.
- **OUT of scope (do not build):** P2 social publishing/scheduling, P3 AI video generation (Higgsfield — the metered cost killer). Design the schema/UI so these are additive later, not a rewrite (Architecture Law #4).

## Architecture laws (apply — same template as Aria)
Nova = persona (`personas/nova.md`) + tool belt + loop + scoreboard. She reads the SHARED company brain (ICP, offer, brand voice, goals from `memory_entries`) — content must sound like *this* company, not generic. No bottleneck: adding content types or employees later needs no rebuild. Handoffs first-class (e.g. Atlas can assign Nova a content task; output shows in the activity feed).

## 1. Schema (new migration `supabase/content_migration.sql` — list it in handoff so Cowork runs it)
- `content_pieces`: `id`, `company_id`, `employee_id` (='nova'), `type` (`post|script|ugc_brief|caption`), `platform` (`instagram|tiktok|linkedin|x|generic`), `title`, `body`, `status` (`draft|approved|archived`), `brief` (the prompt/angle it came from), `created_at`. RLS consistent with `leads`/`lead_drafts`.

## 2. Nova's generation engine
- Reuse the existing agent pattern (`app/api/agent/run/route.ts` is Aria's reference) — a Nova run that pulls brand voice + ICP + offer from `memory_entries`, takes an angle/brief from the owner (or a default content plan), and produces a small batch of on-brand pieces via `create_content_piece`-style tool calls. Real brand voice in, real drafts out — never generic filler.
- **Meter it:** content = ~1h per `lib/pricing.mjs`/`estimateHours`; gate + debit via `lib/hours.mjs`; `is_internal` bypass; never charge for a thin/failed run.

## 3. `/studio` page (Nova's surface, mirror `/leads` quality)
- Nova's identity at the top (her orb once Track B lands; her green; her current focus).
- A "create" affordance: owner gives an angle/topic (or "surprise me from our brand") → Nova drafts a batch.
- Content list grouped by type/platform, each piece: title, body preview, platform, status; actions = approve / edit / archive / copy-to-clipboard. Approve flips `status='approved'` (no publishing yet — clipboard is the v1 handoff to the human).
- **Empty state** (CEO.md Three Gaps): intentional, shows what Nova *could* make, one-click to first batch. Hover/press micro-interactions. Typography hierarchy. Light theme.
- Add Studio to the nav/sidebar.

## Definition of done
`build` / `lint` / `tsc` green. Ship `scripts/verify-nova-studio.mjs` proving: a content piece persists + is account-isolated (RLS); status transitions draft→approved→archived; metering debits once per run and `is_internal` bypasses; generation refuses to invent when brand voice is empty (prompts onboarding instead). (DB firewalled from Cowork — include "run it + report results" in handoff.) List pending migrations. Commit + push, log to `CHANGELOG.md`. Acceptance test (Mitri): ask Nova for content and get on-brand drafts in Surge's voice, approvable in one click.
