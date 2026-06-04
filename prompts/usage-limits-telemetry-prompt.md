# Build Prompt — Usage Limits + Cost Telemetry + Pricing Restructure
*Handed off June 4, 2026. Decided in CEO meeting with Mitri. This is THE PLAN — it ships before the first paying customer.*

## Why (read this first — the math that forces this build)

Verified unit economics (live API pricing, June 2026):
- One heavy Aria task run (research loop + ~30 web searches): **$1.50–2.00**
- Chat: pennies per message (prompt caching already live in `/api/chat`)
- Nova: text/images trivial; video $1–1.50/clip on fast tiers, $7.50 premium — regenerations multiply real cost 3–5x
- Typical customer: ~$90/mo COGS → ~70% margin. **Uncapped 24/7 agent usage: $6–10K/mo COGS against $299–999 revenue.** One unlimited customer erases thirty good ones.

**The business model (new, June 4):**
- **"Hire the Team" flagship: $999/mo** (Aria + Nova + Opus) — the default plan
- **Single employee: $399/mo** (entry door, raised from $299)
- Enterprise: custom
- Target model at 20 team customers, ALL maxing limits: revenue $19,980/mo, COGS ~$5,800, ~$13.4K/mo profit. **Limits are what make the worst case a 67% margin instead of bankruptcy. Limits are permanent at every price tier — never remove them, only raise quotas.**

## What to build

### 1. Usage quotas (enforcement on `/api/agent/run`)
Every employee gets a **workday**:
- **1 autonomous daily cycle + 60 commanded task runs per month** per employee
- Nova media (when video lands): metered in **deliverables** — 8 videos/mo included, regenerations count against quota
- New table `usage_counters` (company_id, employee_id, period YYYY-MM, runs_used, cycles_used, media_used) with RLS matching existing tenant isolation
- `/api/agent/run` checks the counter BEFORE starting; increments atomically on start (not completion — a crashed run still consumed API spend)
- At quota: return a clean 429-style JSON the UI understands — and the employee delivers it **in character**: "I've hit my capacity for the month — want to add capacity, or hire another teammate?" The cap message is an upsell, never an error. No raw error text to the user.
- Limits must be config, not constants — one row/object per plan tier so raising quotas later is a data change, not a deploy.

### 2. Cost telemetry (from day one — future pricing is set from this data)
- New table `usage_log`: company_id, employee_id, task_id, run_id, model, input_tokens, cache_read_tokens, output_tokens, web_searches, est_cost_usd, created_at
- `/api/agent/run` already receives usage in every Anthropic response — record it per call, sum per run
- est_cost_usd computed from a `model_rates` config (Sonnet 4.6: $3/$15 per M, cache reads $0.30/M, web search $0.01 each) so rate changes don't rewrite history
- Nothing user-facing yet. This is the dataset that prices v2 tiers.

### 3. Cost discipline (cheap wins, same PR)
- Route research/scoring subtasks to **Haiku 4.5** ($1/$5) where output quality allows; Aria's actual prospect-facing writing stays on Sonnet
- Keep prompt caching on in the run route (verify `cache_control` is set on the system block like the chat route)

### 4. Pricing page restructure (`app/landing/page.tsx`)
- Flagship card: **"Hire the Team" $999/mo** — Aria + Nova + Opus, positioned as the default/most-popular
- Single employee: **$399/mo**
- Enterprise: custom (contact)
- Keep the honesty rules: no fabricated customer counts, no fake certifications. Frame against the $50K/yr human, never against "cheaper AI tools."
- Quotas appear as plan features in plain language ("Your team works a full workday, every day"), not as scary limits.

## Verification (required — completion is proven, not asked about)
Ship `scripts/verify-usage-limits.mjs` following the existing `verify-*.mjs` pattern:
1. usage_counters + usage_log tables exist, RLS enforced (anon reads = 0 rows)
2. Simulated run increments the counter; run #61 in a month is refused with the in-character capacity message
3. A real (or stubbed) run writes a usage_log row with non-zero tokens and est_cost_usd
4. Quota values load from config, not hardcoded
5. Landing page renders $999 team / $399 single (grep the built page)

Also: **commit everything to git when verification passes** — the repo still has one commit and that is an open risk.
