import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase';
import { getBalance } from '@/lib/hours.mjs';
import { estimateHours } from '@/lib/pricing.mjs';
import { DAILY_TOPUP_TARGET, OPEN_LEAD_CEILING } from '@/lib/usage-config.mjs';

// Daily pipeline TOP-UP — the replenishing drip that grows a company's pipeline toward a
// working level over several days, so the small (fast, comped) day-one activation batch is
// just the seed. A scheduler hits this once a day; it runs session-less on the service
// role, so it's guarded by CRON_SECRET (dormant until SUPABASE_SERVICE_ROLE_KEY + CRON_SECRET
// are set). Each company's actual research happens in /api/agent/run (its OWN 60s budget,
// invoked with Bearer CRON_SECRET) — so slow research never fights the heartbeat's sweep
// for the same 60 seconds. vercel.json schedules it ~30 min after the heartbeat.
//
// THE RULE (self-regulating, not a pile that grows forever):
//   • Ceiling on UN-WORKED leads — top up only while open leads (not yet contacted/warm/
//     booked/closed) are below OPEN_LEAD_CEILING. As the owner works leads, the open count
//     drops and tomorrow's run refills it. A pipeline is a queue, not a hoard.
//   • Daily drip cap — at most DAILY_TOPUP_TARGET fresh, de-duplicated leads per run.
//   • Metered — CHARGED against included hours; out-of-hours surfaces an upsell (once/day)
//     and skips; the target tapers as month-end hours shrink. Internal accounts bypass.
//   • Market-exhaustion exit lives in the run itself (mostly-duplicate run → upsell nudge).

export const maxDuration = 300; // Pro ceiling — the per-company top-up does real research

// OPEN_LEAD_CEILING + DAILY_TOPUP_TARGET come from lib/usage-config.mjs (single source).
const TIME_BUDGET_MS = 45_000;  // leave headroom under the 60s wall; the rest wait for tomorrow
// Statuses that mean a lead is already being worked or is closed — NOT "open/un-worked".
const WORKED = ['contacted', 'warm', 'replied', 'meeting', 'disqualified', 'recycled'];

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const q = new URL(request.url).searchParams.get('secret') || '';
  return bearer === secret || q === secret;
}

type Skip = 'ceiling' | 'out_of_hours' | 'no_target' | 'already_today' | 'claim_failed' | 'hours_error';
type Result = { companyId: string; skipped?: Skip; ran?: boolean; leads?: number; target?: number };

async function runCron(request: Request) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const cronSecret = process.env.CRON_SECRET;
  if (!serviceKey || !cronSecret) return Response.json({ ok: false, reason: 'cron_not_configured' }, { status: 503 });
  if (!authorized(request)) return new Response('Unauthorized', { status: 401 });

  const supabase = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false },
  });
  const origin = new URL(request.url).origin;
  const today = new Date().toISOString().slice(0, 10);

  // Only companies that finished onboarding AND went through day-one activation — never
  // top up before the first run has seeded the pipeline.
  const { data: companies } = await supabase
    .from('companies').select('id, industry, is_internal')
    .eq('onboarding_complete', true).not('activated_at', 'is', null);

  const start = Date.now();
  const results: Result[] = [];
  for (const c of companies ?? []) {
    if (Date.now() - start > TIME_BUDGET_MS) break; // time wall — the rest get topped up tomorrow

    // Ceiling: how many un-worked leads are already waiting? Stop if we're at/over it.
    const { count: openCount } = await supabase
      .from('leads').select('id', { count: 'exact', head: true })
      .eq('company_id', c.id).not('status', 'in', `(${WORKED.join(',')})`);
    const room = OPEN_LEAD_CEILING - (openCount ?? 0);
    if (room <= 0) { results.push({ companyId: c.id, skipped: 'ceiling' }); continue; }

    // Metered budget + taper (internal accounts bypass all of this).
    let target = Math.min(DAILY_TOPUP_TARGET, room);
    if (!c.is_internal) {
      let balance: number;
      try { balance = await getBalance(supabase, c.id); }
      catch { results.push({ companyId: c.id, skipped: 'hours_error' }); continue; } // hours not live yet
      const runCost = estimateHours('aria_run');
      if (balance < runCost) {
        // Out of hours — turn the limit into the upsell (deduped once/day), then skip.
        await supabase.from('activity_log').insert({
          id: `topup-hours-${c.id}-${today}`, company_id: c.id, employee_id: 'aria',
          action: `Aria's used this month's hours building your pipeline — add hours or upgrade to keep her prospecting.`,
          detail: null, timestamp: 'just now', sort_order: Date.now(),
        }).then(() => {}, () => {});
        results.push({ companyId: c.id, skipped: 'out_of_hours' });
        continue;
      }
      if (balance < runCost * 3) target = Math.min(target, 5); // taper as month-end approaches
    }
    if (target <= 0) { results.push({ companyId: c.id, skipped: 'no_target' }); continue; }

    // Daily idempotency: a deterministic task id is the atomic claim — one top-up per
    // company per day. A second cron firing (or a retry) collides on the PK and skips.
    const taskId = `topup_${c.id}_${today}`;
    const { error: claimErr } = await supabase.from('tasks').insert({
      id: taskId, company_id: c.id, title: 'Top up your lead pipeline',
      assignee_id: 'aria', priority: 'medium', project: 'Daily pipeline top-up', status: 'queued',
      created_at: today, due_date: today, sort_order: Date.now(),
    });
    if (claimErr) { results.push({ companyId: c.id, skipped: claimErr.code === '23505' ? 'already_today' : 'claim_failed' }); continue; }

    // Run it. Each run gets its OWN serverless invocation (its own 60s), authenticated as
    // the cron — so research time never competes with this orchestrator's budget.
    const res = await fetch(`${origin}/api/agent/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${cronSecret}` },
      body: JSON.stringify({ taskId, topup: true, companyId: c.id, target }),
    }).then((r) => r.json()).catch(() => ({ ok: false }));

    results.push({ companyId: c.id, ran: !!res?.ok, leads: res?.created_this_run?.leads ?? 0, target });
  }

  return Response.json({ ok: true, processed: results.length, results });
}

// Vercel cron invokes with GET (auto-sending Authorization: Bearer $CRON_SECRET); support
// POST too for manual/curl triggers. Both run the same job.
export const GET = runCron;
export const POST = runCron;
