-- ============================================================================
-- Surge — Inbound capture + speed-to-lead (Phase 1, the B2C/residential motion).
-- Run AFTER warm_signal_migration.sql (it redefines leads_status_check, so run this
-- LAST among the leads migrations). Paste into the Supabase SQL Editor and Run
-- (Run without RLS if prompted). Safe to re-run (idempotent).
--
-- CONSENT IS THE SPINE. We never text/call anyone without a stored consent record
-- (TCPA — $500–$1,500 statutory damages PER message, no cap). Sending is gated
-- server-side on: a consent record + the channel + 10DLC registration + no opt-out.
-- is_internal does NOT bypass consent or 10DLC (that's legal, not billing).
-- ============================================================================

-- 1. Extend leads (don't fork) — the inbound motion lives alongside Aria's cold research.
alter table leads add column if not exists origin           text not null default 'researched'; -- researched | inbound
alter table leads add column if not exists consent_text     text;        -- the EXACT disclosure wording shown
alter table leads add column if not exists consent_at       timestamptz; -- when consent was captured
alter table leads add column if not exists consent_ip       text;        -- captured at the form
alter table leads add column if not exists consent_channels text[];      -- {sms,call,email}
alter table leads add column if not exists source           text;        -- surge_form | meta_lead_ads | google_lead_form | click_to_call
alter table leads add column if not exists first_touch_at   timestamptz; -- speed-to-lead: first outbound touch

-- phone already exists on leads (from leads_migration). 'inbound' + 'engaged' join the enum.
alter table leads drop constraint if exists leads_status_check;
alter table leads add constraint leads_status_check
  check (status in ('new','inbound','engaged','qualified','drafted','contacted','warm','replied','meeting','disqualified','recycled'));

-- 2. The conversation log — every SMS/call in or out.
create table if not exists lead_messages (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  lead_id     uuid not null references leads(id) on delete cascade,
  direction   text not null check (direction in ('inbound','outbound')),
  channel     text not null default 'sms' check (channel in ('sms','email','call')),
  body        text,
  twilio_sid  text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_lead_messages_lead on lead_messages (lead_id, created_at);
create index if not exists idx_lead_messages_company on lead_messages (company_id, created_at desc);

-- 3. Company telephony config + 10DLC gate + owner bridge number.
alter table companies add column if not exists twilio_number                 text;
alter table companies add column if not exists twilio_messaging_service_sid  text;
alter table companies add column if not exists owner_phone                   text;
alter table companies add column if not exists tendlc_status                 text not null default 'none'; -- none | pending | registered

-- 4. SMS opt-out suppression (TCPA STOP) — checked before EVERY send. Company+phone.
create table if not exists sms_suppressions (
  company_id uuid not null references companies(id) on delete cascade,
  phone      text not null,
  reason     text not null default 'stop',
  created_at timestamptz not null default now(),
  primary key (company_id, phone)
);

-- RLS — same per-company pattern as leads / lead_drafts.
alter table lead_messages   enable row level security;
alter table sms_suppressions enable row level security;

drop policy if exists lead_messages_own on lead_messages;
create policy lead_messages_own on lead_messages
  for all to authenticated
  using      (company_id in (select id from companies where user_id = auth.uid()))
  with check (company_id in (select id from companies where user_id = auth.uid()));

drop policy if exists sms_suppressions_own on sms_suppressions;
create policy sms_suppressions_own on sms_suppressions
  for all to authenticated
  using      (company_id in (select id from companies where user_id = auth.uid()))
  with check (company_id in (select id from companies where user_id = auth.uid()));

-- 5. create_inbound_lead — the normalized endpoint inserts via this SECURITY DEFINER
-- RPC (anon-callable, like register_link_click) so a public form/ad webhook can create
-- a lead without a session, without exposing any other tenant's data. Stamps consent +
-- source + the Lead Lifeline fields. consent_at is set ONLY when a channel was granted.
create or replace function create_inbound_lead(
  p_company uuid, p_name text, p_phone text, p_email text,
  p_consent_text text, p_consent_channels text[], p_consent_ip text, p_source text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company companies%rowtype;
  v_lead_id uuid;
  v_has_consent boolean := coalesce(array_length(p_consent_channels, 1), 0) > 0;
begin
  select * into v_company from companies where id = p_company;
  if v_company.id is null then
    return jsonb_build_object('ok', false, 'reason', 'company_not_found');
  end if;

  insert into leads (
    company_id, business_name, vertical, source_url, score, score_reasons, status,
    origin, phone, email, consent_text, consent_at, consent_ip, consent_channels, source,
    next_action, next_action_at
  ) values (
    p_company, coalesce(nullif(p_name, ''), 'Inbound lead'), 'other',
    coalesce(nullif(p_source, ''), 'inbound'), 0, '{}'::jsonb, 'inbound',
    'inbound', nullif(p_phone, ''), nullif(p_email, ''), nullif(p_consent_text, ''),
    case when v_has_consent then now() else null end,
    nullif(p_consent_ip, ''), p_consent_channels, coalesce(nullif(p_source, ''), 'surge_form'),
    'Speed-to-lead: respond to inbound', now()
  )
  returning id into v_lead_id;

  insert into activity_log (id, company_id, employee_id, action, detail, timestamp, sort_order)
  values ('a' || replace(gen_random_uuid()::text, '-', ''), p_company, 'aria',
          'New inbound lead' || coalesce(' — ' || nullif(p_name, ''), ''), p_source, 'just now',
          floor(extract(epoch from clock_timestamp()) * 1000)::bigint);

  return jsonb_build_object(
    'ok', true, 'lead_id', v_lead_id, 'has_consent', v_has_consent,
    'tendlc_status', v_company.tendlc_status, 'company_name', v_company.company_name
  );
end;
$$;
grant execute on function create_inbound_lead(uuid, text, text, text, text, text[], text, text) to anon, authenticated;
