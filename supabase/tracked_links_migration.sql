-- ============================================================================
-- Surge — Short opaque tracked-link codes (trustworthy CTA URLs).
-- Run AFTER warm_signal_migration.sql. Paste into the Supabase SQL Editor and Run
-- (Run without RLS if prompted). Safe to re-run (idempotent).
--
-- WHY: the CTA link used to embed the full ~180-char HMAC token in the path
-- (surgehq.io/api/r/<huge base64>), which reads as phishing, hurts deliverability, and
-- trips spam filters. Instead we store a short random base62 code → {lead, company} and
-- serve surgehq.io/r/<code>. The code is unguessable and resolved server-side, so no
-- signed token needs to ride in the public URL. The warm-signal logic is unchanged:
-- /r/[code] resolves the code then calls the SAME register_link_click() RPC.
-- ============================================================================

create table if not exists tracked_links (
  code        text primary key,                                   -- short random base62 (7–8 chars)
  lead_id     uuid not null references leads(id)      on delete cascade,
  company_id  uuid not null references companies(id)  on delete cascade,
  created_at  timestamptz not null default now()
);
create index if not exists idx_tracked_links_lead on tracked_links (lead_id);

-- RLS — same per-company pattern as leads / lead_drafts. Owners (authenticated) may
-- insert/read their own company's codes at draft/send time; the prospect (anon) never
-- touches the table directly — they resolve a code they already hold via the RPC below.
alter table tracked_links enable row level security;
drop policy if exists tracked_links_own on tracked_links;
create policy tracked_links_own on tracked_links
  for all to authenticated
  using      (company_id in (select id from companies where user_id = auth.uid()))
  with check (company_id in (select id from companies where user_id = auth.uid()));

-- resolve_tracked_link — anon-callable code → {lead, company} lookup (the prospect isn't
-- logged in). SECURITY DEFINER so the table stays locked down: anon can only resolve a
-- code it already has, never enumerate the table. Mirrors register_link_click's grant.
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
