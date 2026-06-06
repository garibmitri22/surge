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
