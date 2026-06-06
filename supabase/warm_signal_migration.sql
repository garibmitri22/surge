-- ============================================================================
-- Surge — Wedge: warm-signal architecture (tracked CTA click → warm → owner ping)
-- Run AFTER leads_migration.sql. Paste into the Supabase SQL Editor and Run
-- (Run without RLS if prompted). Safe to re-run (idempotent).
--
-- The warm signal is an ACTION, never us reading replies: every outbound email
-- carries ONE signed per-lead CTA link. A click hits /api/r/[token], which calls
-- register_link_click() — increment, promote new/qualified/drafted/contacted → warm
-- (never downgrade replied/meeting), refresh the Lead Lifeline, log activity, and
-- hand back the owner's email so the route can ping them. A booking calls
-- register_booking() → status 'meeting' + booked_at. Both are SECURITY DEFINER and
-- granted to anon (the prospect is not logged in) — mirroring email_unsubscribe.
-- ============================================================================

-- 1. Warm-signal columns -----------------------------------------------------
alter table leads      add column if not exists first_clicked_at timestamptz;
alter table leads      add column if not exists click_count      integer not null default 0;
alter table leads      add column if not exists booked_at        timestamptz;
alter table companies  add column if not exists booking_url      text; -- optional Calendly etc.

-- 2. Add 'warm' to the status enum (between 'contacted' and 'replied') --------
alter table leads drop constraint if exists leads_status_check;
alter table leads add constraint leads_status_check
  check (status in ('new','qualified','drafted','contacted','warm','replied','meeting','disqualified','recycled'));

-- 3. register_link_click — a prospect clicked the tracked CTA. -----------------
-- Idempotent on repeat clicks: click_count always increments, first_clicked_at is
-- set once, and promotion to 'warm' happens only from a pre-warm status (so
-- replied/meeting/warm are never downgraded). newly_warm = true only on the real
-- transition, so the owner is pinged exactly once.
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

-- 4. register_booking — a prospect submitted the interest page / booked. --------
-- Sets status 'meeting' (the top of the funnel — an upgrade from any active state,
-- never a downgrade) and stamps booked_at once. newly_booked = true only on the
-- real transition, so the stronger owner notification fires once.
create or replace function register_booking(
  p_lead uuid, p_company uuid, p_name text, p_email text, p_time_pref text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead         leads%rowtype;
  v_company      companies%rowtype;
  v_owner_email  text;
  v_newly_booked boolean := false;
begin
  select * into v_lead from leads where id = p_lead and company_id = p_company;
  if v_lead.id is null then
    return jsonb_build_object('ok', false, 'reason', 'lead_not_found');
  end if;

  update leads
     set status        = 'meeting',
         booked_at      = coalesce(booked_at, now()),
         next_action    = 'Prepare for the booked meeting',
         next_action_at = now() + interval '1 day',
         notes          = coalesce(notes, '') || E'\n[Booking] '
                          || coalesce(nullif(p_name, ''), 'prospect')
                          || coalesce(' <' || nullif(p_email, '') || '>', '')
                          || coalesce(' — prefers ' || nullif(p_time_pref, ''), ''),
         updated_at     = now()
   where id = p_lead and company_id = p_company
     and status <> 'meeting';
  v_newly_booked := found;

  insert into activity_log (id, company_id, employee_id, action, detail, timestamp, sort_order)
  values (
    'a' || replace(gen_random_uuid()::text, '-', ''),
    p_company, 'aria',
    v_lead.business_name || ' booked a meeting',
    nullif(p_time_pref, ''), 'just now',
    floor(extract(epoch from clock_timestamp()) * 1000)::bigint
  );

  select * into v_company from companies where id = p_company;
  select email into v_owner_email from auth.users where id = v_company.user_id;

  return jsonb_build_object(
    'ok',            true,
    'newly_booked',  v_newly_booked,
    'business_name', v_lead.business_name,
    'owner_email',   v_owner_email,
    'company_name',  v_company.company_name
  );
end;
$$;
grant execute on function register_booking(uuid, uuid, text, text, text) to anon, authenticated;
