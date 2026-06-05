-- ============================================================================
-- Surge — Hours metering (replaces the invisible workday quota)
-- Run AFTER schema.sql, auth_migration, chat_migration, leads_migration,
-- usage_migration, onboarding_migration. Paste into the Supabase SQL Editor and
-- Run (Run without RLS if prompted).
--
-- DECISION (Mitri, June 5): the invisible per-feature quota is dead. One visible
-- currency, branded HOURS. Work costs hours; the balance is on the dashboard;
-- running out is a purchase moment (overtime). usage_log telemetry from the
-- usage build STAYS as the pricing source; the quota ENFORCEMENT is replaced by
-- this ledger. (Customer-facing word is always "hours"; tables may say ledger.)
-- ============================================================================

-- Plan drives the monthly allowance. Default 'single' until a plan is chosen.
alter table companies add column if not exists plan text not null default 'single';

-- 1. The ledger — append-only. Balance = sum(delta). balance_after is the running
--    total after each entry (for the timesheet UI). Fractional hours (1 decimal).
create table if not exists hours_ledger (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  delta         numeric(10,1) not null,        -- + grant/overtime, - debit
  balance_after numeric(10,1) not null,
  reason        text not null,                 -- 'Monthly allowance' | 'Aria task run' | 'Overtime pack' ...
  employee_id   text,                          -- whose time this was (null for grants/overtime)
  ref_type      text,                          -- 'grant' | 'task' | 'research' | 'overtime'
  ref_id        text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_hours_ledger_company on hours_ledger (company_id, created_at desc);

alter table hours_ledger enable row level security;
drop policy if exists hours_ledger_own on hours_ledger;
create policy hours_ledger_own on hours_ledger
  for all to authenticated
  using      (company_id in (select id from companies where user_id = auth.uid()))
  with check (company_id in (select id from companies where user_id = auth.uid()));

-- 2. Balance = sum of the ledger.
create or replace function hours_balance(p_company uuid)
returns numeric language sql stable security invoker as $$
  select coalesce(sum(delta), 0)::numeric(10,1) from hours_ledger where company_id = p_company;
$$;
grant execute on function hours_balance(uuid) to authenticated;

-- 3. Append one entry atomically (advisory lock serializes concurrent writes per
--    company so balance_after is always correct). Returns the new balance.
create or replace function hours_append(p_company uuid, p_delta numeric, p_reason text, p_employee text default null, p_ref_type text default null, p_ref_id text default null)
returns numeric language plpgsql security invoker as $$
declare v_bal numeric;
begin
  perform pg_advisory_xact_lock(hashtext(p_company::text));
  select coalesce(sum(delta), 0) into v_bal from hours_ledger where company_id = p_company;
  v_bal := round(v_bal + p_delta, 1);
  insert into hours_ledger (company_id, delta, balance_after, reason, employee_id, ref_type, ref_id)
  values (p_company, round(p_delta, 1), v_bal, p_reason, p_employee, p_ref_type, p_ref_id);
  return v_bal;
end; $$;
grant execute on function hours_append(uuid, numeric, text, text, text, text) to authenticated;

-- 4. Grant the monthly allowance when a company is created (until Stripe drives it).
--    Allowance numbers MUST match lib/pricing.mjs ALLOWANCES (verify-hours asserts this).
create or replace function grant_initial_hours()
returns trigger language plpgsql security definer as $$
declare v_allow numeric;
begin
  v_allow := case new.plan when 'team' then 200 else 70 end;
  perform hours_append(new.id, v_allow, 'Monthly allowance', null, 'grant', to_char(now(), 'YYYY-MM'));
  return new;
end; $$;
drop trigger if exists trg_grant_initial_hours on companies;
create trigger trg_grant_initial_hours after insert on companies
  for each row execute function grant_initial_hours();

-- 5. Backfill: grant existing companies their allowance once (those created before
--    this migration have no ledger yet). Safe to re-run (only grants where empty).
do $$
declare c record;
begin
  for c in select id, plan from companies where id not in (select distinct company_id from hours_ledger) loop
    perform hours_append(c.id, case c.plan when 'team' then 200 else 70 end, 'Monthly allowance', null, 'grant', to_char(now(), 'YYYY-MM'));
  end loop;
end $$;
