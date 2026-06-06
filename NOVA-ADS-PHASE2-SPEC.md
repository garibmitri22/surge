# Nova runs the ads — closed-loop growth engine (Phase 2 spec, PREPPED not built)

> **Status: NOT BUILT — intentionally held.** Per the kickoff's hard rule, `CEO.md`
> ("revenue beats features; never build ahead of the critical path"; Failure #4 feature
> factory), and `SCALING-ROADMAP.md` (this is **Phase 2**; Phase 1 = prove the managed
> loop on a real customer, still in flight, **zero paying customers today**), this is
> "prepped for the future." **Build trigger: Aria's existing half (research → outreach →
> warm → book + reactivation) is PROVEN on ≥1 real paying customer.** Until then, building
> the expensive, risky top of the funnel before the bottom is proven is backwards.

This doc is build-ready so the dev can execute Phase 2a fast the moment it unblocks.

## The full loop (the flagship)
Nova researches the market + what competitors advertise → Nova creates ad creative + a
campaign plan → ads run on Meta/Google → leads captured via the **existing inbound seam**
(`app/api/inbound/lead` + `/meta` + `/google` + form/sms) → **Aria** nurtures + books
(speed-to-lead + warm-signal + booking already shipped) → owner closes → results feed the
Workforce Score + weekly briefing → optimize + repeat.

Most of the bottom half already exists. Phase 2 only adds the **top** (Nova as strategist,
then manager) and connects it to the proven bottom.

---

## Phase 2a — Nova as ad STRATEGIST (LOW risk, build first)
Captures ~80% of the value at near-zero risk: **no autonomous spend, no ad-API write access.**
Nova produces launch-ready assets the **owner launches manually**.

### What Nova does
- Research the vertical/market and, via the **public Meta Ad Library / Google Ads
  Transparency Center (read-only)**, what's being advertised — to inform angles. Reuse the
  `web_search` tool already wired in `app/api/agent/run`. Pull brand voice + offer + ICP
  from `memory_entries` (+ the active vertical pack, `lib/verticals`).
- Produce **ready-to-run ad creative + copy** + a **recommended campaign plan** (platform,
  objective, audience, daily budget, duration). All `status='draft'` — the owner launches.

### Build plan (data-driven; mirrors the Nova Studio + Aria run patterns already shipped)
1. **Migration `supabase/ads_migration.sql`**
   - Extend `content_pieces` checks: `type` add `'ad'`; `platform` add `'meta'`, `'google'`.
   - New `ad_campaigns` (id, company_id, platform `meta|google`, objective, audience text,
     daily_budget numeric, duration_days int, plan text, status `'draft'` default, created_at)
     + RLS consistent with `content_pieces`. **No spend columns that an agent can act on.**
2. **`app/api/studio/ads/route.ts`** — Nova ad-strategist run (model the Aria run + Nova
   studio engine): brand-voice required (else refuse → onboarding, like `/api/studio/run`);
   `web_search` for competitor-ad/market research (read-only); tools `create_ad` (→
   `content_pieces` type `'ad'`) + `propose_campaign` (→ `ad_campaigns` draft) + `log_activity`
   + `report`. **Metered `nova_ads` (1h)** via `lib/hours.mjs` (`is_internal` bypass; 0 on
   thin). Add `nova_ads: 1` to `HOUR_PRICES` in `lib/pricing.mjs`.
3. **Surface** — an "Ads" group on `/studio`: ad creatives + the campaign plan, each with a
   clear **"Launch this on Meta/Google yourself"** note (Phase 2a = manual launch). A "Have
   Nova plan an ad campaign" button. Approve/edit/copy like the rest of Studio.
4. **Connect the loop (mostly already done):** ad-sourced leads already arrive through the
   inbound endpoints tagged `source` (`meta_lead_ads` / `google_lead_form`) and `origin
   ='inbound'`, then Aria's speed-to-lead takes over. Add a visible **Nova → Aria hand-off**
   activity line when an ad-sourced lead lands ("Nova's ad brought in a lead — Aria's on it").
5. **Score / briefing:** already real — ad-sourced inbound leads count as leads, warm/meeting
   via the wedge; the honest pipeline estimate (`estimatePipeline` = (qualified+warm) ×
   avg deal value) already covers them. No change needed.

### Phase 2a DONE (when unblocked)
build/lint/tsc green. Nova produces real, on-brand ad creative + a launch-ready campaign
plan; resulting leads (when the owner runs the ads) flow through inbound → Aria with a clear
hand-off; **no autonomous spend anywhere.** Ship `scripts/verify-nova-ads.mjs`:
- ads run produces `content_pieces` type `'ad'` + an `ad_campaigns` **draft**;
- **no Meta/Google ad-API write** anywhere (grep: no `graph.facebook.com` / `googleads`
  write calls in the route — research is read-only `web_search` only);
- campaigns are `status='draft'` (owner launches manually);
- metered once (`nova_ads`), `is_internal` bypass, 0 on thin;
- an ad-sourced inbound lead (source `meta_lead_ads`) lands in `leads` and is Aria's.

---

## Phase 2b — Nova MANAGES live campaigns (HIGH risk, gated on 2a + real proof)
Only after 2a ships AND a real customer's loop is proven. Write access to Meta/Google Ads
APIs to launch + adjust campaigns and read performance, then optimize.

### Money guardrails (NON-NEGOTIABLE — design before any write access)
- **Hard owner-set spend cap** per campaign + per account; stored server-side, owner-only.
- Owner **approves the budget and any increase**. Nova can **NEVER** raise spend beyond the
  cap or without explicit approval — enforce server-side, not in the prompt.
- **Fail-closed:** on any error/ambiguity, **pause** the campaign; never overspend.
- **Full transparent reporting:** every spend + result visible to the owner; reconciled
  against the platform.
- **Honesty:** report only measurable/attributable results; never claim conversion lift we
  can't attribute (matches the credibility-pass + outcomes-first honesty rule).
- Ad **spend is the customer's own budget** — separate, **never metered as our hours**.
  Meter only Nova's work (research/creative/optimization analysis) in hours.

---

## Architecture notes
- Data-driven per vertical (reuse `lib/verticals` for angles/voice).
- Reuse, don't rebuild: `web_search` (Aria run), `content_pieces` + Studio surface, the
  inbound seam, the warm-signal/booking loop, `lib/hours.mjs` metering, `estimatePipeline`.
- The hand-off "one pipeline, two employees" is the demo: Nova's ad → inbound → Aria books,
  visible in the activity feed.
