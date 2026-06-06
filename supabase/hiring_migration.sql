-- ============================================================================
-- Surge — Hire-an-employee: per-company enablement + waitlist capture.
-- Run AFTER schema.sql + auth_migration. Paste into the Supabase SQL Editor and Run
-- (Run without RLS if prompted). Safe to re-run (idempotent).
--
-- hired_employees is the per-company enablement list (the entitlement SEAM that Stripe
-- will gate later — single = the one chosen employee, team = all; internal = all).
-- waitlist_signups captures interest in pipeline roles (the visible expansion path).
-- ============================================================================

alter table companies add column if not exists hired_employees text[] not null default '{}';

create table if not exists waitlist_signups (
  company_id uuid not null references companies(id) on delete cascade,
  role_id    text not null,            -- pipeline role id (recruiter|cs|ea|pm|finance)
  created_at timestamptz not null default now(),
  primary key (company_id, role_id)    -- one signup per role per company (idempotent)
);

alter table waitlist_signups enable row level security;
drop policy if exists waitlist_signups_own on waitlist_signups;
create policy waitlist_signups_own on waitlist_signups
  for all to authenticated
  using      (company_id in (select id from companies where user_id = auth.uid()))
  with check (company_id in (select id from companies where user_id = auth.uid()));
