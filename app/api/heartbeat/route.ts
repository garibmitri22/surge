import { createSupabaseServerClient } from '@/lib/supabase-server';
import { resolveCanonicalCompanyId } from '@/lib/company-resolve';
import { applySweep } from '@/lib/heartbeat.mjs';

// Per-owner heartbeat (authenticated). The dashboard fires this once a day so the
// Lead Lifeline sweep runs the moment the owner opens the app: overdue leads become
// a recovery task for Aria, dead leads get recycled. Idempotent per day. The
// while-you-sleep, all-companies version lives at /api/cron/heartbeat.
export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const companyId = await resolveCanonicalCompanyId(supabase, user.id);
  if (!companyId) return Response.json({ ok: false, reason: 'no_company' });

  try {
    const report = await applySweep(supabase, companyId);
    return Response.json({ ok: true, ...report });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'sweep failed' }, { status: 500 });
  }
}
