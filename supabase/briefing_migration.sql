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
