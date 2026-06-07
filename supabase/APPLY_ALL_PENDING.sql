-- Surge — apply ALL pending June-6 migrations, in dependency order. Paste into Supabase SQL Editor and Run. Idempotent.

-- ===================== internal_flag_migration.sql =====================
-- Internal / owner-unlimited account flag (ops-now, June 6).
-- An internal company is exempt from ALL metering + plan/employee gating: Mitri's
-- own Surge company, so he can demo / dogfood / grow without hitting hour walls.
-- Also the basis for future staff accounts. Server-enforced in lib/hours.mjs.
-- Safe to re-run (idempotent).

alter table companies
  add column if not exists is_internal boolean not null default false;

-- SECURITY HARDENING — is_internal is a PRIVILEGE flag, not customer data.
-- The companies_own RLS policy is FOR ALL with `using (user_id = auth.uid())`, which
-- would otherwise let any authenticated owner update ANY column on their own row —
-- including self-granting is_internal=true for unlimited free work. A column-level
-- REVOKE is ineffective here because the authenticated role holds table-level UPDATE
-- (table grants supersede column grants), so we enforce immutability with a trigger:
-- only service_role or direct SQL (this migration) may set/change is_internal.
create or replace function surge_protect_is_internal() returns trigger
  language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.is_internal and current_user in ('authenticated', 'anon') then
      raise exception 'is_internal is not user-settable';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.is_internal is distinct from old.is_internal
       and current_user in ('authenticated', 'anon') then
      raise exception 'is_internal is not user-modifiable';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_is_internal on companies;
create trigger trg_protect_is_internal
  before insert or update on companies
  for each row execute function surge_protect_is_internal();

-- Flag the owner's company. Runs as the migration role (not authenticated), so the
-- trigger allows it. Match by company name OR the owner's auth email for robustness.
update companies
set is_internal = true
where lower(coalesce(company_name, '')) = 'surge'
   or user_id in (
     select id from auth.users where lower(email) = 'garibmitri1@gmail.com'
   );

-- Sanity (expect >= 1 after this runs):
-- select count(*) as internal_companies from companies where is_internal;

-- ===================== hiring_migration.sql =====================
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

-- ===================== activation_migration.sql =====================
-- ============================================================================
-- Surge — Day-one activation: companies.activated_at.
-- Run AFTER schema.sql + auth_migration. Paste into the Supabase SQL Editor and Run
-- (Run without RLS if prompted). Safe to re-run (idempotent).
--
-- Stamps when the owner's FIRST (comped) Aria run was kicked, the moment onboarding
-- completes. Gates the one-time comp (the run is free only while this is null) and
-- prevents the day-one activation from firing more than once.
-- ============================================================================
alter table companies add column if not exists activated_at timestamptz;

-- ===================== briefing_migration.sql =====================
-- ============================================================================
-- Surge — Weekly CEO Briefing email (the day-14 retention anchor).
-- Run AFTER the prior migrations. Paste into the Supabase SQL Editor and Run
-- (Run without RLS if prompted). Safe to re-run (idempotent).
--
-- Every Monday ~08:00 in the owner's timezone, the existing daily heartbeat cron
-- emails the owner a one-page summary. briefing_sends is the idempotency ledger:
-- one row per (company, ISO-week) so a cron retry can never double-send, and it
-- also stores that week's score so next week can show the ▲/▼ delta honestly.
-- ============================================================================

-- Owner timezone (nullable → the sender falls back to America/Chicago, Mitri's tz).
alter table companies add column if not exists timezone text;

create table if not exists briefing_sends (
  company_id uuid    not null references companies(id) on delete cascade,
  week_key   text    not null,                       -- ISO week in the owner's tz, e.g. '2026-W23'
  score      integer,                                -- the Number at send time → next week's delta
  status     text    not null default 'sent',        -- sent | quiet | skipped
  sent_at    timestamptz not null default now(),
  primary key (company_id, week_key)                 -- idempotency: at most one send per company per week
);
create index if not exists idx_briefing_sends_company on briefing_sends (company_id, sent_at desc);

-- RLS consistent with the other per-company tables (the cron uses the service role,
-- which bypasses RLS; this just keeps any client read scoped to the owner).
alter table briefing_sends enable row level security;
drop policy if exists briefing_sends_own on briefing_sends;
create policy briefing_sends_own on briefing_sends
  for all to authenticated
  using      (company_id in (select id from companies where user_id = auth.uid()))
  with check (company_id in (select id from companies where user_id = auth.uid()));

-- ===================== content_migration.sql =====================
-- ============================================================================
-- Surge — Nova's Studio: content_pieces (her CRM, the way leads is Aria's).
-- Run AFTER the prior migrations. Paste into the Supabase SQL Editor and Run
-- (Run without RLS if prompted). Safe to re-run (idempotent).
--
-- P1: Nova generates on-brand marketing content from the shared company brain
-- (post | script | ugc_brief | caption) → owner approves/edits/archives. NOTHING
-- is published. The model is channel-agnostic by design (Architecture Law #4 +
-- nova.md "channel-agnostic content model"), so P2 publishing/scheduling and P3
-- video generation are ADDITIVE — add columns (e.g. published_at, scheduled_for,
-- media_url) later, never a rewrite.
-- ============================================================================

create table if not exists content_pieces (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  employee_id text not null default 'nova',
  type        text not null check (type in ('post','script','ugc_brief','caption')),
  platform    text not null default 'generic'
                check (platform in ('instagram','tiktok','linkedin','x','generic')),
  title       text not null,
  body        text not null,
  status      text not null default 'draft' check (status in ('draft','approved','archived')),
  brief       text,                          -- the angle/brief this piece came from
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_content_company on content_pieces (company_id, created_at desc);

-- Row Level Security — same per-company pattern as leads / lead_drafts.
alter table content_pieces enable row level security;
drop policy if exists content_pieces_own on content_pieces;
create policy content_pieces_own on content_pieces
  for all to authenticated
  using      (company_id in (select id from companies where user_id = auth.uid()))
  with check (company_id in (select id from companies where user_id = auth.uid()));

-- ===================== hours_reset_migration.sql =====================
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

-- ===================== warm_signal_migration.sql =====================
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

-- ===================== inbound_migration.sql =====================
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

-- ===================== reactivation_migration.sql =====================
-- ============================================================================
-- Surge — Database reactivation (wake up the owner's existing list).
-- Run AFTER inbound_migration.sql. Paste into the Supabase SQL Editor and Run
-- (Run without RLS if prompted). Safe to re-run (idempotent).
--
-- Reactivation reuses the whole engine (leads, lead_drafts, lead_messages, the
-- tracked-link warm signal, deliverDraft/email, Twilio). It only adds the
-- RELATIONSHIP facts that make a past-customer message land. origin='reactivation'
-- needs NO constraint change (leads.origin is free text, default 'researched').
--
-- CONSENT by channel still applies: email leans on the established business
-- relationship + CAN-SPAM (already built); SMS/voice require a per-contact consent
-- record (consent_channels includes 'sms'/'call') + 10DLC. Enforced server-side in
-- lib/inbound.mjs canSendSms — is_internal never bypasses it.
-- ============================================================================

alter table leads add column if not exists last_seen_at  date;          -- last visit / last quote date
alter table leads add column if not exists past_value    numeric(12,2); -- prior spend / quote amount
alter table leads add column if not exists relationship  text;          -- what they bought/quoted + free notes

-- ===================== tracked_links_migration.sql =====================
-- ============================================================================
-- Surge — Short opaque tracked-link codes (trustworthy CTA URLs).
-- Run AFTER warm_signal_migration.sql. Safe to re-run (idempotent).
--
-- Replaces the ~180-char inline HMAC token in the public CTA URL with a short random
-- base62 code → {lead, company}, so we serve surgehq.io/r/<code> instead of a phishy
-- /api/r/<huge base64>. The code is unguessable and resolved server-side; /r/[code]
-- then calls the SAME register_link_click() RPC, so the warm signal is unchanged.
-- ============================================================================

create table if not exists tracked_links (
  code        text primary key,                                   -- short random base62 (7–8 chars)
  lead_id     uuid not null references leads(id)      on delete cascade,
  company_id  uuid not null references companies(id)  on delete cascade,
  created_at  timestamptz not null default now()
);
create index if not exists idx_tracked_links_lead on tracked_links (lead_id);

alter table tracked_links enable row level security;
drop policy if exists tracked_links_own on tracked_links;
create policy tracked_links_own on tracked_links
  for all to authenticated
  using      (company_id in (select id from companies where user_id = auth.uid()))
  with check (company_id in (select id from companies where user_id = auth.uid()));

create or replace function resolve_tracked_link(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_lead uuid; v_company uuid;
begin
  select lead_id, company_id into v_lead, v_company from tracked_links where code = p_code;
  if v_lead is null then
    return jsonb_build_object('ok', false);
  end if;
  return jsonb_build_object('ok', true, 'lead_id', v_lead, 'company_id', v_company);
end;
$$;
grant execute on function resolve_tracked_link(text) to anon, authenticated;

-- ===================== email_quality_migration.sql =====================
-- A/B transparency-P.S. variant on drafts ('ps' | 'no_ps'), for later reply-rate
-- comparison. Pure additive column. Safe to re-run.
alter table lead_drafts add column if not exists ab_variant text;

-- ===================== SANITY CHECK =====================
select
  (select count(*) from companies where is_internal) as internal_companies,
  to_regclass('public.lead_messages')   is not null  as has_lead_messages,
  to_regclass('public.content_pieces')  is not null  as has_content_pieces,
  to_regclass('public.tracked_links')   is not null  as has_tracked_links,
  exists (select 1 from information_schema.columns where table_name='leads' and column_name='relationship') as leads_has_relationship,
  exists (select 1 from information_schema.columns where table_name='companies' and column_name='activated_at') as companies_has_activated_at;
