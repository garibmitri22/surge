-- ============================================================================
-- Surge — Day-one activation: companies.activated_at.
-- Run AFTER schema.sql + auth_migration. Paste into the Supabase SQL Editor and Run
-- (Run without RLS if prompted). Safe to re-run (idempotent).
--
-- Stamps when the owner's FIRST (comped) Aria run was kicked, the moment onboarding
-- completes. Gates the one-time comp (the run is free only while this is null) and
-- prevents the day-one activation from firing more than once.
-- ============================================================================
alter table companies add column if not exists activated_at timestamptz;
