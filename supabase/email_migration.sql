-- ============================================================================
-- Surge — Email channel scaffolding (Resend sending + CAN-SPAM + warmup)
-- Run AFTER the prior migrations, ONCE the email channel goes live. Paste into the
-- Supabase SQL Editor and Run (Run without RLS if prompted).
--
-- Sending domain: getsurgehq.com (dedicated — never cold-email from the primary).
-- Nothing sends until RESEND_API_KEY is set AND the company has a physical_address
-- (CAN-SPAM). This migration just creates the tables the send helper writes to.
-- ============================================================================

-- CAN-SPAM requires a real physical postal address in every commercial email, and
-- warmup ramps the sending volume from a known start date.
alter table companies add column if not exists physical_address  text;
alter table companies add column if not exists warmup_started_at date;

-- 1. Every send (or skip/fail) is logged. unsub_token is the per-recipient key the
--    unsubscribe link carries. warmup counts 'sent' rows per day against the cap.
create table if not exists email_sends (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  lead_id     text,
  to_email    text not null,
  subject     text not null,
  status      text not null default 'pending',  -- pending | sent | failed | skipped
  reason      text,                             -- why skipped/failed
  provider_id text,                             -- Resend message id
  unsub_token uuid not null default gen_random_uuid(),
  created_at  timestamptz not null default now()
);
create index if not exists idx_email_sends_company on email_sends (company_id, created_at desc);
create index if not exists idx_email_sends_token   on email_sends (unsub_token);

alter table email_sends enable row level security;
drop policy if exists email_sends_own on email_sends;
create policy email_sends_own on email_sends
  for all to authenticated
  using      (company_id in (select id from companies where user_id = auth.uid()))
  with check (company_id in (select id from companies where user_id = auth.uid()));

-- 2. Suppression list — the honored unsubscribe + bounce list. Checked before EVERY
--    send. One row per (company, email).
create table if not exists email_suppressions (
  company_id uuid not null references companies(id) on delete cascade,
  email      text not null,
  reason     text not null default 'unsubscribe',
  created_at timestamptz not null default now(),
  primary key (company_id, email)
);
alter table email_suppressions enable row level security;
drop policy if exists email_suppressions_own on email_suppressions;
create policy email_suppressions_own on email_suppressions
  for all to authenticated
  using      (company_id in (select id from companies where user_id = auth.uid()))
  with check (company_id in (select id from companies where user_id = auth.uid()));

-- 3. One-click unsubscribe for recipients (no auth). SECURITY DEFINER so an anon
--    recipient can suppress themselves via their token, without seeing any data.
--    Resolves token -> (company, email) and adds the suppression. Idempotent.
create or replace function email_unsubscribe(p_token uuid)
returns boolean language plpgsql security definer as $$
declare v_company uuid; v_email text;
begin
  select company_id, to_email into v_company, v_email from email_sends where unsub_token = p_token limit 1;
  if v_company is null then return false; end if;
  insert into email_suppressions (company_id, email, reason)
  values (v_company, lower(v_email), 'unsubscribe')
  on conflict (company_id, email) do nothing;
  return true;
end; $$;
grant execute on function email_unsubscribe(uuid) to anon, authenticated;
