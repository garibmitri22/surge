-- ============================================================================
-- Surge — Hours no-rollover RESET (fixes the "198h of 70h" stacking bug).
-- Run AFTER hours_migration.sql. Paste into the Supabase SQL Editor and Run
-- (Run without RLS if prompted). Safe to re-run (idempotent).
--
-- BUG: the monthly allowance was being ADDED each period (and the backfill could
-- re-run), so a non-internal balance climbed past the plan cap (70/200). v1 policy is
-- NO ROLLOVER: each month the balance RESETS to the plan allowance, never stacks.
-- ============================================================================

-- grant_monthly_allowance — RESET (not add) this period's balance to the plan
-- allowance. Idempotent per period (ref_type='grant', ref_id=period): a second call
-- in the same month is a no-op. A new period resets, dropping any leftover (no
-- rollover). Overtime purchased mid-month stacks on top until the next reset.
create or replace function grant_monthly_allowance(p_company uuid, p_period text default to_char(now(), 'YYYY-MM'))
returns numeric language plpgsql security definer as $$
declare v_plan text; v_allow numeric; v_bal numeric; v_exists int;
begin
  select count(*) into v_exists from hours_ledger
    where company_id = p_company and ref_type = 'grant' and ref_id = p_period;
  if v_exists > 0 then
    return hours_balance(p_company); -- already granted this period — never stack
  end if;
  select plan into v_plan from companies where id = p_company;
  v_allow := case v_plan when 'team' then 200 else 70 end;
  v_bal := hours_balance(p_company);
  -- delta brings the balance to EXACTLY the allowance (may be negative = reset down).
  perform hours_append(p_company, round(v_allow - v_bal, 1), 'Monthly allowance', null, 'grant', p_period);
  return hours_balance(p_company);
end; $$;
grant execute on function grant_monthly_allowance(uuid, text) to authenticated, service_role;

-- One-time correction of legacy STACKED balances: any non-internal company whose
-- balance exceeds its plan allowance AND that never purchased overtime is brought back
-- down to the allowance. Conservative — leaves overtime accounts untouched.
do $$
declare c record; v_allow numeric; v_bal numeric; v_ot int;
begin
  for c in select id, plan from companies where coalesce(is_internal, false) = false loop
    v_allow := case c.plan when 'team' then 200 else 70 end;
    v_bal := hours_balance(c.id);
    select count(*) into v_ot from hours_ledger where company_id = c.id and ref_type = 'overtime';
    if v_bal > v_allow and v_ot = 0 then
      perform hours_append(c.id, round(v_allow - v_bal, 1), 'Balance correction (no rollover)', null, 'grant', 'correction-' || to_char(now(), 'YYYY-MM'));
    end if;
  end loop;
end $$;
