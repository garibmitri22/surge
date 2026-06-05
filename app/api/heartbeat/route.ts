import { createSupabaseServerClient } from '@/lib/supabase-server';
import { applySweep } from '@/lib/heartbeat.mjs';

// Per-owner heartbeat (authenticated). The dashboard fires this once a day so the
// Lead Lifeline sweep runs the moment the owner opens the app: overdue leads become
// a recovery task for Aria, dead leads get recycled. Idempotent per day. The
// while-you-sleep, all-companies version lives at /api/cron/heartbeat.
export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { data: company } = await supabase
    .from('companies').select('id').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!company) return Response.json({ ok: false, reason: 'no_company' });

  try {
    const report = await applySweep(supabase, company.id);
    return Response.json({ ok: true, ...report });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'sweep failed' }, { status: 500 });
  }
}
