-- ============================================================================
-- Surge — HQ Chat v2: leads + lead_drafts (Aria's CRM)
-- Run AFTER schema.sql, auth_migration.sql, chat_migration.sql.
-- Paste into the Supabase SQL Editor and Run (Run without RLS if prompted).
--
-- Surge IS the CRM. Multi-tenant, RLS-scoped by company_id (Step 2 pattern).
-- Lead Lifeline law: a lead may NEVER exist without next_action + next_action_at
-- (enforced as NOT NULL at the DB level).
-- ============================================================================

create table if not exists leads (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references companies(id) on delete cascade,
  business_name     text not null,
  vertical          text not null check (vertical in ('med_spa', 'real_estate', 'gym', 'other')),
  location          text,
  website           text,
  contact_name      text,
  contact_role      text,
  email             text,
  phone             text,
  source_url        text not null,                 -- honesty audit trail: where it was found
  score             integer not null default 0 check (score >= 0 and score <= 100),
  score_reasons     jsonb not null,                -- {icp_fit:{pts,reason}, pain:{...}, ability:{...}, reachability:{...}}
  status            text not null default 'new'
                      check (status in ('new','qualified','drafted','contacted','replied','meeting','disqualified','recycled')),
  disqualify_reason text,
  next_action       text not null,                 -- Lead Lifeline law
  next_action_at    timestamptz not null,          -- Lead Lifeline law
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Idempotency: a company can't hold the same business twice (dedupe key).
create unique index if not exists idx_leads_dedupe
  on leads (company_id, lower(business_name), coalesce(lower(location), ''));
create index if not exists idx_leads_company_score on leads (company_id, score desc);

create table if not exists lead_drafts (
  id              uuid primary key default gen_random_uuid(),
  lead_id         uuid not null references leads(id) on delete cascade,
  company_id      uuid not null references companies(id) on delete cascade,
  channel         text not null default 'email' check (channel in ('email')),
  sequence_step   integer not null default 1,
  subject         text not null,
  body            text not null,
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_drafts_company on lead_drafts (company_id, lead_id);

-- Row Level Security (same per-company pattern as tasks) ----------------------
alter table leads       enable row level security;
alter table lead_drafts enable row level security;

drop policy if exists leads_own on leads;
create policy leads_own on leads
  for all to authenticated
  using      (company_id in (select id from companies where user_id = auth.uid()))
  with check (company_id in (select id from companies where user_id = auth.uid()));

drop policy if exists drafts_own on lead_drafts;
create policy drafts_own on lead_drafts
  for all to authenticated
  using      (company_id in (select id from companies where user_id = auth.uid()))
  with check (company_id in (select id from companies where user_id = auth.uid()));
