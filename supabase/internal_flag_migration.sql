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
