-- ============================================================================
-- Surge — Onboarding v2 (Atlas intake) lifecycle migration
-- Run AFTER schema.sql, auth_migration.sql, chat_migration.sql, leads_migration.sql,
-- usage_migration.sql. Paste into the Supabase SQL Editor and Run
-- (choose "Run without RLS" if prompted, so the DDL applies as admin).
--
-- WHY: onboarding is becoming a CONVERSATION with Atlas, not a one-shot form. A
-- chat needs a `companies` row to write to AS IT GOES (incremental
-- save_company_profile, memory_entries need a company_id), so a DRAFT row is
-- created the moment intake starts. That means "is the user onboarded?" can no
-- longer mean "does a company row exist" — it becomes an explicit FLAG
-- (onboarding_complete), set only when Atlas has the required set and the server
-- verifies it. (Decision approved in MEMORY: completion = flag, not row-existence.)
-- ============================================================================

-- 1. Lifecycle columns --------------------------------------------------------
-- onboarding_complete: the gate. Default false so every new (draft) row is
--   incomplete until complete_onboarding flips it server-side.
-- created_at: stable ordering for drafts AND completed rows. completed_at is NULL
--   on a draft, so we can no longer order by it to find "the" company.
-- research_findings: the one site-research result, persisted so Atlas can re-inject
--   it for confirmation across turns/reloads and we never pay for a second scan.
alter table companies add column if not exists onboarding_complete boolean      not null default false;
alter table companies add column if not exists created_at          timestamptz  not null default now();
alter table companies add column if not exists research_findings   jsonb;

-- 2. Relax NOT NULL on the form fields ----------------------------------------
-- A draft row starts empty and is filled in as the owner confirms each detail.
-- The fields stay typed text; they're just nullable until intake fills them.
alter table companies alter column company_name     drop not null;
alter table companies alter column industry         drop not null;
alter table companies alter column target_customers drop not null;
alter table companies alter column brand_tone       drop not null;
alter table companies alter column main_goal        drop not null;
alter table companies alter column competitors      drop not null;
alter table companies alter column employee_count   drop not null;
alter table companies alter column completed_at     drop not null;

-- 3. Backfill existing rows ---------------------------------------------------
-- Any company created under the OLD form already completed onboarding (it only
-- ever inserted a row on the final step), so mark those complete.
update companies set onboarding_complete = true where completed_at is not null;

create index if not exists idx_companies_created on companies(created_at desc);

-- 4. Brand-assets storage bucket ----------------------------------------------
-- Logos uploaded (or pulled from the site) during intake. Private bucket; access
-- is RLS-scoped per company by the FIRST path segment = a company id the user owns
-- (path convention: "<company_id>/<filename>").
insert into storage.buckets (id, name, public)
values ('brand-assets', 'brand-assets', false)
on conflict (id) do nothing;

-- Storage RLS: a signed-in user may read/write objects in brand-assets only under
-- a folder named after one of THEIR company ids. Anon has no policy = denied.
drop policy if exists brand_assets_own_read   on storage.objects;
drop policy if exists brand_assets_own_write  on storage.objects;
drop policy if exists brand_assets_own_update on storage.objects;
drop policy if exists brand_assets_own_delete on storage.objects;

create policy brand_assets_own_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] in (select id::text from companies where user_id = auth.uid())
  );

create policy brand_assets_own_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] in (select id::text from companies where user_id = auth.uid())
  );

create policy brand_assets_own_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] in (select id::text from companies where user_id = auth.uid())
  );

create policy brand_assets_own_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] in (select id::text from companies where user_id = auth.uid())
  );
