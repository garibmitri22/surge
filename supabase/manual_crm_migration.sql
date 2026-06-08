-- ============================================================================
-- Surge — Manual CRM controls: the owner gets the wheel.
-- Run AFTER warm_signal_migration.sql + inbound_migration.sql. Paste into the Supabase
-- SQL Editor and Run (Run without RLS if prompted). Safe to re-run (idempotent).
--
-- The owner can manually MOVE a lead between stages, DELETE leads, and EDIT fields right in
-- the app (no more SQL-editor surgery to remove junk). A manual stage is an OVERRIDE Aria must
-- RESPECT: manual_override=true marks a lead the owner set by hand, and the automated paths
-- (the Lead Lifeline sweep + the tracked-click promotion) skip it — so Aria never re-opens a
-- lead the owner closed or moves one they placed. Adds 'won'/'lost' as terminal stages.
-- ============================================================================

-- 1. Override flag + the new terminal stages -------------------------------------------------
alter table leads add column if not exists manual_override boolean not null default false;

alter table leads drop constraint if exists leads_status_check;
alter table leads add constraint leads_status_check
  check (status in ('new','inbound','engaged','qualified','drafted','contacted','warm','replied','meeting','won','lost','disqualified','recycled'));

-- 2. The tracked-click promotion must RESPECT a manual override -------------------------------
-- Same as warm_signal_migration's register_link_click, with one added guard: a click never
-- changes the status of a lead the owner set by hand (manual_override). It still increments
-- click_count + logs the click (recording the real signal), but won't auto-move an owner-placed
-- lead — and won/lost/disqualified were never in the promote-from set, so a closed lead is safe.
create or replace function register_link_click(p_lead uuid, p_company uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead         leads%rowtype;
  v_company      companies%rowtype;
  v_owner_email  text;
  v_newly_warm   boolean := false;
begin
  select * into v_lead from leads where id = p_lead and company_id = p_company;
  if v_lead.id is null then
    return jsonb_build_object('ok', false, 'reason', 'lead_not_found');
  end if;

  update leads
     set click_count      = coalesce(click_count, 0) + 1,
         first_clicked_at = coalesce(first_clicked_at, now()),
         updated_at       = now()
   where id = p_lead and company_id = p_company;

  update leads
     set status         = 'warm',
         next_action    = 'Follow up — they clicked your link (warm)',
         next_action_at  = now() + interval '1 day'
   where id = p_lead and company_id = p_company
     and coalesce(manual_override, false) = false   -- never override what the owner set by hand
     and status in ('new','qualified','drafted','contacted');
  v_newly_warm := found;

  insert into activity_log (id, company_id, employee_id, action, detail, timestamp, sort_order)
  values (
    'a' || replace(gen_random_uuid()::text, '-', ''),
    p_company, 'aria',
    case when v_newly_warm
         then v_lead.business_name || ' clicked your link — they''re warm'
         else v_lead.business_name || ' clicked your link again' end,
    null, 'just now',
    floor(extract(epoch from clock_timestamp()) * 1000)::bigint
  );

  select * into v_company from companies where id = p_company;
  select email into v_owner_email from auth.users where id = v_company.user_id;

  return jsonb_build_object(
    'ok',            true,
    'newly_warm',    v_newly_warm,
    'click_count',   (select click_count from leads where id = p_lead),
    'business_name', v_lead.business_name,
    'booking_url',   v_company.booking_url,
    'owner_email',   v_owner_email,
    'company_name',  v_company.company_name
  );
end;
$$;
grant execute on function register_link_click(uuid, uuid) to anon, authenticated;
