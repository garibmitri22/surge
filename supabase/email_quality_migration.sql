-- ============================================================================
-- Surge — Email quality: A/B transparency-P.S. variant on drafts.
-- Run AFTER leads_migration.sql. Paste into the Supabase SQL Editor and Run. Idempotent.
--
-- Each generated draft is randomly assigned an AI-transparency P.S. variant ('ps' or
-- 'no_ps') so we can compare reply rates later. Stored on the draft itself (nullable —
-- older drafts simply have no variant). Pure additive column, no behavior change to RLS.
-- ============================================================================

alter table lead_drafts add column if not exists ab_variant text; -- 'ps' | 'no_ps'
