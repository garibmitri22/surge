-- ============================================================================
-- Surge — Usage quotas + cost telemetry
-- Run AFTER schema.sql, auth_migration.sql, chat_migration.sql, leads_migration.sql.
-- Paste into the Supabase SQL Editor and Run (Run without RLS if prompted).
--
-- WHY: uncapped 24/7 agent usage can run $6-10K/mo COGS against $299-999 revenue.
-- Quotas make the worst case a healthy margin instead of bankruptcy. Limits are
-- PERMANENT at every tier — we only ever raise quotas (a data change), never remove
-- them. Telemetry records real per-call cost from day one so v2 pricing is set from
-- data, not guesses.
--
-- Multi-tenant, RLS-scoped by company_id (same pattern as tasks/leads).
-- ============================================================================

-- 1. usage_counters — one row per (company, employee, month). The quota ledger.
create table if not exists usage_counters (
  company_id  uuid not null references companies(id) on delete cascade,
  employee_id text not null,                       -- 'aria' | 'nova' | 'opus' (text, like tasks.assignee_id)
  period      text not null,                       -- billing month, 'YYYY-MM'
  runs_used   integer not null default 0,          -- commanded task runs consumed this month
  cycles_used integer not null default 0,          -- autonomous daily cycles consumed (future scheduler)
  media_used  integer not null default 0,          -- Nova media deliverables consumed (future)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (company_id, employee_id, period)
);

-- 2. usage_log — one row per Anthropic API call. The cost dataset (never user-facing).
create table if not exists usage_log (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references companies(id) on delete cascade,
  employee_id       text not null,
  task_id           text,
  run_id            uuid,                           -- groups all calls in a single run
  model             text not null,
  input_tokens      integer not null default 0,     -- uncached input (+ cache-creation) tokens
  cache_read_tokens integer not null default 0,
  output_tokens     integer not null default 0,
  web_searches      integer not null default 0,
  est_cost_usd      numeric(10,5) not null default 0,
  created_at        timestamptz not null default now()
);

create index if not exists idx_usage_log_company on usage_log (company_id, created_at desc);
create index if not exists idx_usage_log_run     on usage_log (run_id);

-- 3. Atomic quota consumption -------------------------------------------------
-- Increments runs_used by 1 IFF still under the limit, in one atomic statement
-- (no read-then-write race). Returns the new runs_used, or NULL when the caller
-- is already at/over the limit (caller must refuse the run). We charge on START,
-- not completion: a crashed run still consumed real API spend.
-- SECURITY INVOKER (default): runs as the caller, so RLS still applies and a user
-- can only ever touch their own company's counter.
create or replace function consume_task_run(p_company uuid, p_employee text, p_period text, p_limit int)
returns int
language plpgsql
as $$
declare
  v_used int;
begin
  if p_limit < 1 then
    return null;
  end if;
  insert into usage_counters as uc (company_id, employee_id, period, runs_used)
  values (p_company, p_employee, p_period, 1)
  on conflict (company_id, employee_id, period)
  do update set runs_used = uc.runs_used + 1, updated_at = now()
    where uc.runs_used < p_limit
  returning uc.runs_used into v_used;
  return v_used; -- NULL when the guard (runs_used < p_limit) blocked the update = at limit
end;
$$;

grant execute on function consume_task_run(uuid, text, text, int) to authenticated;

-- 4. Row Level Security (same per-company pattern as tasks/leads) -------------
alter table usage_counters enable row level security;
alter table usage_log      enable row level security;

drop policy if exists usage_counters_own on usage_counters;
create policy usage_counters_own on usage_counters
  for all to authenticated
  using      (company_id in (select id from companies where user_id = auth.uid()))
  with check (company_id in (select id from companies where user_id = auth.uid()));

drop policy if exists usage_log_own on usage_log;
create policy usage_log_own on usage_log
  for all to authenticated
  using      (company_id in (select id from companies where user_id = auth.uid()))
  with check (company_id in (select id from companies where user_id = auth.uid()));
