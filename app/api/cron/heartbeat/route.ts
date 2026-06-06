import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase';
import { applySweep } from '@/lib/heartbeat.mjs';
import { isMondayInTz, sendWeeklyBriefingForCompany } from '@/lib/briefing.mjs';

// The while-you-sleep heartbeat: a scheduler (Vercel/Supabase cron) hits this once a
// day and it runs the Lead Lifeline sweep for EVERY onboarded company. Needs no user
// session, so it uses the service-role key (bypasses RLS) — and is therefore guarded
// by CRON_SECRET. Dormant until both are set (mirrors the email scaffolding pattern):
//   SUPABASE_SERVICE_ROLE_KEY=...   CRON_SECRET=...
// vercel.json schedules a daily GET; Vercel auto-sends Authorization: Bearer $CRON_SECRET.
// (POST also works for manual triggers; both share runCron.)

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const q = new URL(request.url).searchParams.get('secret') || '';
  return bearer === secret || q === secret;
}

// Vercel cron invokes with GET (auto-sending Authorization: Bearer $CRON_SECRET);
// support POST too for manual/curl triggers. Both run the same job.
async function runCron(request: Request) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || !process.env.CRON_SECRET) {
    return Response.json({ ok: false, reason: 'cron_not_configured' }, { status: 503 });
  }
  if (!authorized(request)) return new Response('Unauthorized', { status: 401 });

  const supabase = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: companies } = await supabase
    .from('companies').select('id, timezone, is_internal').eq('onboarding_complete', true);

  const now = Date.now();
  const nowDate = new Date(now);
  const results: { companyId: string; overdueCount: number; recycleCount: number; taskCreated: boolean }[] = [];
  const briefings: { companyId: string; sent: boolean; reason: string }[] = [];
  for (const c of companies ?? []) {
    try {
      const r = await applySweep(supabase, c.id, now);
      results.push({ companyId: c.id, ...r });
    } catch { /* skip a company that errors; keep sweeping the rest */ }

    // No-rollover: reset the month's allowance (idempotent per period — only acts once
    // a new month begins). Internal accounts are unlimited, so skip them.
    if (!c.is_internal) {
      try { await supabase.rpc('grant_monthly_allowance', { p_company: c.id }); } catch { /* non-fatal */ }
    }

    // Weekly CEO Briefing: only on the company's local Monday. The daily cron runs
    // ~08:00 Central (13:00 UTC), so for the default tz this lands Monday morning.
    // Idempotency lives in briefing_sends, so a same-day retry never double-sends.
    try {
      if (isMondayInTz(nowDate, c.timezone || undefined)) {
        const b = await sendWeeklyBriefingForCompany(supabase, c.id, { now });
        briefings.push({ companyId: c.id, sent: b.sent, reason: b.reason });
      }
    } catch { /* a briefing failure must never break the daily sweep */ }
  }
  return Response.json({ ok: true, companies: results.length, results, briefings });
}

export const GET = runCron;
export const POST = runCron;
