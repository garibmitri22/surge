-- ============================================================================
-- Surge — Database reactivation (wake up the owner's existing list).
-- Run AFTER inbound_migration.sql. Paste into the Supabase SQL Editor and Run
-- (Run without RLS if prompted). Safe to re-run (idempotent).
--
-- Reactivation reuses the whole engine (leads, lead_drafts, lead_messages, the
-- tracked-link warm signal, deliverDraft/email, Twilio). It only adds the
-- RELATIONSHIP facts that make a past-customer message land. origin='reactivation'
-- needs NO constraint change (leads.origin is free text, default 'researched').
--
-- CONSENT by channel still applies: email leans on the established business
-- relationship + CAN-SPAM (already built); SMS/voice require a per-contact consent
-- record (consent_channels includes 'sms'/'call') + 10DLC. Enforced server-side in
-- lib/inbound.mjs canSendSms — is_internal never bypasses it.
-- ============================================================================

alter table leads add column if not exists last_seen_at  date;          -- last visit / last quote date
alter table leads add column if not exists past_value    numeric(12,2); -- prior spend / quote amount
alter table leads add column if not exists relationship  text;          -- what they bought/quoted + free notes
