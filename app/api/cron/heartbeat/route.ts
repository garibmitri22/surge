import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase';
import { applySweep } from '@/lib/heartbeat.mjs';

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
    .from('companies').select('id').eq('onboarding_complete', true);

  const now = Date.now();
  const results: { companyId: string; overdueCount: number; recycleCount: number; taskCreated: boolean }[] = [];
  for (const c of companies ?? []) {
    try {
      const r = await applySweep(supabase, c.id, now);
      results.push({ companyId: c.id, ...r });
    } catch { /* skip a company that errors; keep sweeping the rest */ }
  }
  return Response.json({ ok: true, companies: results.length, results });
}

export const GET = runCron;
export const POST = runCron;
