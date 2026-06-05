-- ============================================================================
-- Surge — one-time cleanup: collapse duplicate PROFILE memory entries
-- Run once in the Supabase SQL Editor (Run without RLS). Safe to re-run.
--
-- WHY: intake re-confirms profile facts as it goes (e.g. an early "Offer — TBD"
-- then the final offer), and the old remember_detail INSERTed every time, leaving
-- duplicate rows (Mitri's brain had two "Offer" entries). The chat route now
-- UPSERTs these singleton types, but existing duplicates need a one-time sweep.
--
-- Keeps the NEWEST row per (company_id, type) — highest sort_order, ties broken by
-- id — and deletes the older ones. Only touches the singleton profile types.
-- ============================================================================
delete from memory_entries m
using memory_entries keep
where m.type in ('icp', 'offer', 'voice', 'goal', 'brand-kit')
  and keep.type = m.type
  and keep.company_id is not distinct from m.company_id
  and (keep.sort_order > m.sort_order
       or (keep.sort_order = m.sort_order and keep.id > m.id));
