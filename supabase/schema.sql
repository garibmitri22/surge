-- ============================================================================
-- Surge — Supabase schema + seed
-- Paste this whole file into the Supabase SQL Editor (New query) and Run.
-- It is safe to re-run: it drops and recreates the tables, then re-seeds them.
--
-- NOTE ON SECURITY: There is no auth yet, so this is single-tenant. Row Level
-- Security (RLS) is intentionally DISABLED on every table below so the public
-- anon key can read/write. When auth lands, enable RLS on all tables and add
-- per-user policies before going multi-tenant.
-- ============================================================================

-- Clean slate -----------------------------------------------------------------
drop table if exists activity_log;
drop table if exists memory_entries;
drop table if exists tasks;
drop table if exists employees;
drop table if exists companies;

-- Tables ----------------------------------------------------------------------

-- Company profile (written by onboarding). Single-tenant for now.
create table companies (
  id               uuid primary key default gen_random_uuid(),
  company_name     text not null,
  industry         text not null,
  target_customers text not null,
  brand_tone       text not null,
  main_goal        text not null,
  competitors      text not null,
  employee_count   text not null,
  completed_at     timestamptz not null
);

-- AI employees
create table employees (
  id                text primary key,
  name              text not null,
  role              text not null,
  avatar            text not null,
  color             text not null,
  status            text not null,
  current_task      text not null,
  performance_score integer not null,
  uptime            text not null,
  tasks_today       integer not null,
  bio               text not null,
  personality       text not null,
  kpis              jsonb not null,
  responsibilities  jsonb not null
);

-- Tasks. created_at / due_date are stored as text to match the existing
-- TypeScript shape exactly (due_date can be a free value like 'TBD').
-- sort_order controls display order (higher = shown first / newest on top).
create table tasks (
  id          text primary key,
  title       text not null,
  assignee_id text not null,
  priority    text not null,
  project     text not null,
  status      text not null,
  created_at  text not null,
  due_date    text not null,
  sort_order  bigint not null
);

-- Activity feed (read-only seed for now). timestamp is text ('2 min ago').
create table activity_log (
  id          text primary key,
  employee_id text not null,
  action      text not null,
  timestamp   text not null,
  detail      text,
  sort_order  bigint not null
);

-- Company memory / knowledge base
create table memory_entries (
  id         text primary key,
  type       text not null,
  title      text not null,
  content    text not null,
  tags       jsonb not null,
  updated_at text not null,
  sort_order bigint not null
);

-- Disable Row Level Security (single-tenant, no auth yet — see note at top).
alter table companies      disable row level security;
alter table employees      disable row level security;
alter table tasks          disable row level security;
alter table activity_log   disable row level security;
alter table memory_entries disable row level security;

-- Seed: employees -------------------------------------------------------------
insert into employees (id, name, role, avatar, color, status, current_task, performance_score, uptime, tasks_today, bio, personality, kpis, responsibilities) values
('aria', 'Aria', 'Sales Representative', 'AR', '#a78bfa', 'active', 'Running outreach sequence for Q3 prospects', 87, '99.8%', 14,
 'Aria is your AI Sales Representative — sharp, direct, and relentless. She handles everything from prospect research to booked meetings so your pipeline never goes cold.',
 'Sharp, direct, persuasive. Sounds like a top-performing SDR. Never generic, always specific.',
 '[{"label":"Leads Found","value":"247","change":18},{"label":"Emails Sent","value":"1,840","change":12},{"label":"Replies","value":"163","change":9},{"label":"Meetings Booked","value":"28","change":22},{"label":"Pipeline Value","value":"$184K","change":31,"unit":"$"}]'::jsonb,
 '["Prospect research and list building","Lead generation across target verticals","Personalized outreach campaign creation","Follow-up sequences and re-engagement","CRM updates and data hygiene","Appointment setting and calendar management","Competitive intelligence reporting"]'::jsonb),
('nova', 'Nova', 'Marketing Director', 'NV', '#34d399', 'active', 'Drafting September content calendar', 92, '99.9%', 9,
 'Nova is your AI Marketing Director — creative, strategic, and data-driven. She owns your content, SEO, social, and campaigns end to end.',
 'Creative, strategic, data-informed. Brings ideas but backs them with numbers.',
 '[{"label":"Monthly Traffic","value":"12,400","change":24},{"label":"Leads Generated","value":"94","change":17},{"label":"Content Published","value":"31","change":8},{"label":"Conversion Rate","value":"3.2%","change":5}]'::jsonb,
 '["Content creation and editorial calendar management","SEO strategy and keyword research","Social media planning and post scheduling","Ad copy generation and A/B variant testing","Campaign performance analysis and reporting","Competitor research and positioning","Brand voice consistency across all channels"]'::jsonb),
('opus', 'Opus', 'Operations Assistant', 'OP', '#60a5fa', 'idle', 'Waiting for next task assignment', 79, '98.2%', 6,
 'Opus is your AI Operations Assistant — systematic, precise, and thorough. He keeps the business running: inbox, SOPs, reporting, coordination.',
 'Precise, systematic, thorough. Finds inefficiencies and documents everything.',
 '[{"label":"Tasks Completed","value":"312","change":6},{"label":"Hours Saved","value":"47","change":14},{"label":"Projects Managed","value":"8","change":0}]'::jsonb,
 '["Inbox triage and priority flagging","Task creation and assignment routing","SOP generation and documentation","Weekly performance reporting","Project coordination and tracking","Process optimization and bottleneck identification","Meeting notes and action item tracking"]'::jsonb);

-- Seed: tasks (sort_order descending so t1..t10 render in original order) ------
insert into tasks (id, title, assignee_id, priority, project, status, created_at, due_date, sort_order) values
('t1', 'Research 50 SaaS companies in fintech vertical', 'aria', 'high', 'Q3 Outreach', 'in_progress', '2026-06-01', '2026-06-05', 10),
('t2', 'Write 3 cold email variants for enterprise segment', 'aria', 'high', 'Q3 Outreach', 'in_progress', '2026-06-01', '2026-06-04', 9),
('t3', 'Update CRM — mark Q2 stale leads as lost', 'aria', 'medium', 'CRM Hygiene', 'queued', '2026-06-02', '2026-06-06', 8),
('t4', 'Draft September editorial calendar', 'nova', 'high', 'Content', 'in_progress', '2026-06-01', '2026-06-05', 7),
('t5', 'Write 4 LinkedIn posts for this week', 'nova', 'medium', 'Social', 'completed', '2026-05-30', '2026-06-03', 6),
('t6', 'Keyword research — top 20 target terms', 'nova', 'medium', 'SEO', 'completed', '2026-05-28', '2026-06-01', 5),
('t7', 'A/B test subject lines for June newsletter', 'nova', 'low', 'Email', 'queued', '2026-06-02', '2026-06-08', 4),
('t8', 'Generate onboarding SOP v2', 'opus', 'high', 'SOPs', 'completed', '2026-05-29', '2026-06-02', 3),
('t9', 'Compile weekly performance report', 'opus', 'medium', 'Reporting', 'completed', '2026-06-02', '2026-06-03', 2),
('t10', 'Triage and label inbox — flag urgent items', 'opus', 'medium', 'Operations', 'queued', '2026-06-03', '2026-06-03', 1);

-- Seed: activity_log (sort_order descending so a1..a10 render newest-first) -----
insert into activity_log (id, employee_id, action, timestamp, detail, sort_order) values
('a1', 'aria', 'Added 12 new prospects to Q3 Outreach list', '2 min ago', null, 10),
('a2', 'nova', 'Published LinkedIn post — 340 impressions in first hour', '8 min ago', null, 9),
('a3', 'aria', 'Sent 24 personalized outreach emails', '15 min ago', 'Fintech segment — Series B founders', 8),
('a4', 'opus', 'Completed weekly performance report', '41 min ago', null, 7),
('a5', 'nova', 'Completed keyword research — 20 high-intent terms identified', '1 hr ago', null, 6),
('a6', 'aria', 'Booked 2 discovery calls for Thursday', '2 hr ago', 'Via LinkedIn outreach sequence', 5),
('a7', 'opus', 'Flagged 3 urgent emails for owner review', '3 hr ago', null, 4),
('a8', 'nova', 'Drafted 3 ad copy variants for Google Ads test', '4 hr ago', null, 3),
('a9', 'aria', 'Updated CRM — 47 records cleaned and tagged', '5 hr ago', null, 2),
('a10', 'opus', 'Generated onboarding SOP v2 — 14 steps documented', '6 hr ago', null, 1);

-- Seed: memory_entries (sort_order descending so m1..m6 render newest-first) ----
insert into memory_entries (id, type, title, content, tags, updated_at, sort_order) values
('m1', 'company', 'Company Overview', 'We are an AI workforce platform helping business owners replace and augment traditional hires with AI employees. Our mission is to build the operating system for AI workers. Target: business owners and operators.', '["core","mission"]'::jsonb, '2026-06-01', 6),
('m2', 'customer', 'Ideal Customer Profile', 'Business owners with 1–20 employees, $500K–$5M revenue, frustrated with hiring costs and talent reliability. Industries: SaaS, agencies, professional services, e-commerce. Pain: labor costs, turnover, time spent managing people.', '["ICP","targeting"]'::jsonb, '2026-06-01', 5),
('m3', 'process', 'Outreach Process — Aria', 'Step 1: Research prospect (company size, recent news, role). Step 2: Write personalized first line. Step 3: Send via email. Step 4: Follow up Day 3, Day 7, Day 14. Step 5: Mark as lost after 3 no-replies.', '["sales","outreach"]'::jsonb, '2026-06-02', 4),
('m4', 'sop', 'Weekly Reporting SOP', 'Every Monday: 1) Pull KPI data for all employees. 2) Compare to prior week. 3) Flag any metric down >10%. 4) Generate CEO briefing. 5) Send by 8am.', '["reporting","ops"]'::jsonb, '2026-06-01', 3),
('m5', 'customer', 'Key Competitors', 'Direct: None at scale yet. Indirect: Jasper (content only), Copy.ai (content only), Relevance AI (technical, no UX). Opportunity: No one has built a full AI workforce platform with an HQ feel.', '["competitive","positioning"]'::jsonb, '2026-06-02', 2),
('m6', 'note', 'Pricing Model', '$299/month per AI employee. Clean, scales with usage. Basic plan: 1 employee. Growth: 3 employees. Enterprise: unlimited + custom AI training.', '["pricing","business"]'::jsonb, '2026-06-03', 1);
