-- ============================================================================
-- Surge — Step 3: HQ Chat tables (conversations + messages)
-- Run this AFTER schema.sql and auth_migration.sql. Paste into the Supabase
-- SQL Editor and Run (choose "Run without RLS" if prompted).
--
-- Same multi-tenant pattern as the existing tables: every row is scoped to a
-- company, and RLS limits access to the signed-in user's own company.
-- ============================================================================

create table if not exists conversations (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  employee_id text not null references employees(id),
  title       text,
  created_at  timestamptz not null default now()
);

create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_conversations_company  on conversations(company_id, employee_id);
create index if not exists idx_messages_conversation  on messages(conversation_id, created_at);

-- Row Level Security ---------------------------------------------------------
alter table conversations enable row level security;
alter table messages      enable row level security;

-- conversations: scoped to the user's own company (same pattern as tasks).
drop policy if exists conversations_own on conversations;
create policy conversations_own on conversations
  for all to authenticated
  using      (company_id in (select id from companies where user_id = auth.uid()))
  with check (company_id in (select id from companies where user_id = auth.uid()));

-- messages: scoped through their conversation's company.
drop policy if exists messages_own on messages;
create policy messages_own on messages
  for all to authenticated
  using (
    conversation_id in (
      select c.id from conversations c
      join companies co on co.id = c.company_id
      where co.user_id = auth.uid()
    )
  )
  with check (
    conversation_id in (
      select c.id from conversations c
      join companies co on co.id = c.company_id
      where co.user_id = auth.uid()
    )
  );
