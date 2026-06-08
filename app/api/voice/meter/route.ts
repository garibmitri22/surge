import { createSupabaseServerClient } from '@/lib/supabase-server';
import { resolveCanonicalCompanyId } from '@/lib/company-resolve';
import { voiceConvoHours } from '@/lib/pricing.mjs';
import { debitHours } from '@/lib/hours.mjs';

// JARVIS Phase 3 — meter a live Atlas conversation. The client posts the connected duration
// (seconds) on disconnect; we debit per-minute on the hours ledger. Internal accounts bypass
// (debitHours no-ops); a zero/failed session charges nothing.
export const runtime = 'nodejs';
export const maxDuration = 15;

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  let body: { seconds?: number };
  try { body = await request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }
  const seconds = Math.max(0, Math.min(7200, Number(body.seconds) || 0)); // cap at 2h of safety
  const charge = voiceConvoHours(seconds);
  if (charge <= 0) return Response.json({ ok: true, hours: 0 });

  const companyId = await resolveCanonicalCompanyId(supabase, user.id);
  if (!companyId) return Response.json({ ok: true, hours: 0 });

  try {
    await debitHours(supabase, companyId, charge, 'Atlas voice conversation', { employeeId: 'atlas', refType: 'voice' });
  } catch { /* never block the UI on the ledger */ }
  return Response.json({ ok: true, hours: charge });
}
