-- ============================================================================
-- Surge — Add Atlas, the Chief of Staff (4th AI employee)
-- Run AFTER schema.sql + auth_migration.sql. Paste into the Supabase SQL Editor
-- and Run (Run without RLS if prompted — employees is a shared read-only catalog,
-- so the seed insert must apply as admin).
--
-- Atlas is the backbone employee: he sees the WHOLE board (all employees' open
-- tasks, the lead pipeline, the workforce snapshot) and routes work to the team.
-- KPIs start at 0 — his persona forbids fabricated metrics, so he starts honest.
-- Idempotent: safe to re-run (refreshes the descriptive fields).
-- ============================================================================

insert into employees
  (id, name, role, avatar, color, status, current_task, performance_score, uptime, tasks_today, bio, personality, kpis, responsibilities)
values
  ('atlas', 'Atlas', 'Chief of Staff', 'AT', '#f59e0b', 'active',
   'Holding the whole board — your brief is ready each morning', 0, '100%', 0,
   'Atlas is your AI Chief of Staff — the backbone of the team. He carries the whole picture so you can carry the decision: every task, lead, KPI, and open loop across the workforce. He briefs you each morning, routes work to Aria, Nova, and Opus, and never lets a commitment quietly die.',
   'Calm gravity — measured, certain, economical. The last honest voice in the room: total context, ruthless prioritization, relentless follow-through, zero ego.',
   '[{"label":"Owner Conversations","value":"0","change":0},{"label":"Tasks Routed","value":"0","change":0},{"label":"Open Loops Closed","value":"0","change":0}]'::jsonb,
   '["Daily morning brief (Top 3, decisions needed, team status, the number)","Turning ideas into assigned tasks with owners and deadlines","Routing and chasing work across Aria, Nova, and Opus","Tracking every open loop and surfacing slips with a recovery plan","Logging decisions and their reasoning to company memory","Cross-team pattern recognition and connecting work across lanes","90-day pre-mortems on new directions"]'::jsonb)
on conflict (id) do update set
  name             = excluded.name,
  role             = excluded.role,
  avatar           = excluded.avatar,
  color            = excluded.color,
  status           = excluded.status,
  current_task     = excluded.current_task,
  bio              = excluded.bio,
  personality      = excluded.personality,
  kpis             = excluded.kpis,
  responsibilities = excluded.responsibilities;
