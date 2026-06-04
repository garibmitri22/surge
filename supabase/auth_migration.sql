-- ============================================================================
-- Surge — Auth + multi-tenant RLS migration
-- Run this AFTER supabase/schema.sql. Paste into the Supabase SQL Editor and
-- Run (choose "Run without RLS" if prompted, so the DDL applies as admin).
--
-- What it does:
--   * Ties each company to an auth user (companies.user_id).
--   * Tags tasks/activity/memory with the company that owns them (company_id).
--   * Turns RLS ON for every table so users only ever see their own data.
--   * Keeps `employees` as a shared, read-only catalog for any signed-in user.
-- ============================================================================

-- 1. Ownership columns --------------------------------------------------------
alter table companies      add column if not exists user_id    uuid references auth.users(id) on delete cascade;
alter table tasks          add column if not exists company_id uuid references companies(id) on delete cascade;
alter table activity_log   add column if not exists company_id uuid references companies(id) on delete cascade;
alter table memory_entries add column if not exists company_id uuid references companies(id) on delete cascade;

create index if not exists idx_companies_user   on companies(user_id);
create index if not exists idx_tasks_company    on tasks(company_id);
create index if not exists idx_activity_company on activity_log(company_id);
create index if not exists idx_memory_company   on memory_entries(company_id);

-- 2. Enable Row Level Security on every table ---------------------------------
alter table companies      enable row level security;
alter table employees      enable row level security;
alter table tasks          enable row level security;
alter table activity_log   enable row level security;
alter table memory_entries enable row level security;

-- 3. Policies -----------------------------------------------------------------

-- companies: a user can do anything with their own company row(s) only.
drop policy if exists companies_own on companies;
create policy companies_own on companies
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- tasks / activity_log / memory_entries: scoped to the user's own company.
drop policy if exists tasks_own on tasks;
create policy tasks_own on tasks
  for all to authenticated
  using      (company_id in (select id from companies where user_id = auth.uid()))
  with check (company_id in (select id from companies where user_id = auth.uid()));

drop policy if exists activity_own on activity_log;
create policy activity_own on activity_log
  for all to authenticated
  using      (company_id in (select id from companies where user_id = auth.uid()))
  with check (company_id in (select id from companies where user_id = auth.uid()));

drop policy if exists memory_own on memory_entries;
create policy memory_own on memory_entries
  for all to authenticated
  using      (company_id in (select id from companies where user_id = auth.uid()))
  with check (company_id in (select id from companies where user_id = auth.uid()));

-- employees: shared, read-only catalog. Any signed-in user can read; nobody
-- can write (no insert/update/delete policy = those are denied under RLS).
drop policy if exists employees_read on employees;
create policy employees_read on employees
  for select to authenticated
  using (true);


-- ============================================================================
-- >>> AFTER SIGNUP: claim the demo data for YOUR account <<<
-- The seeded tasks/activity/memory rows have no company_id yet, so nobody can
-- see them. Follow these steps ONCE to attach them to your company:
--
--   1. In the app: sign up, then complete onboarding (this creates your
--      company row, tied to your user).
--   2. Supabase dashboard -> Authentication -> Users -> copy your user's UID.
--   3. Replace YOUR_USER_UID_HERE below with that UID, then run just this block
--      (highlight these 3 update statements and click Run).
--
-- New accounts that skip this step simply start with an empty workspace.
-- ============================================================================

-- update tasks          set company_id = (select id from companies where user_id = 'YOUR_USER_UID_HERE' limit 1) where company_id is null;
-- update activity_log   set company_id = (select id from companies where user_id = 'YOUR_USER_UID_HERE' limit 1) where company_id is null;
-- update memory_entries set company_id = (select id from companies where user_id = 'YOUR_USER_UID_HERE' limit 1) where company_id is null;
