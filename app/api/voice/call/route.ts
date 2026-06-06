import { createSupabaseServerClient } from '@/lib/supabase-server';
import { bridgeCall } from '@/lib/twilio.mjs';

// Owner-triggered "Call now" — the one-tap bridge. The OWNER (authenticated) taps it on
// a lead; Twilio rings the owner's phone, then bridges to the lead (see /api/voice/connect).
// No AI voice in Phase 1. No-ops cleanly when Twilio / owner_phone aren't set.
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  let body: { leadId?: string };
  try { body = await request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }
  const leadId = (body.leadId || '').trim();
  if (!leadId) return new Response('leadId required', { status: 400 });

  const { data: company } = await supabase.from('companies').select('id, owner_phone, twilio_number').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!company) return Response.json({ ok: false, reason: 'no_company' }, { status: 400 });

  // RLS scopes this to the owner's own lead.
  const { data: lead } = await supabase.from('leads').select('id, phone').eq('id', leadId).eq('company_id', company.id).maybeSingle();
  if (!lead?.phone) return Response.json({ ok: false, reason: 'no_lead_phone' });
  if (!company.owner_phone) return Response.json({ ok: false, reason: 'no_owner_phone', message: 'Add your phone number in Settings to use one-tap Call.' });
  if (!company.twilio_number) return Response.json({ ok: false, reason: 'telephony_not_configured', message: 'Finish SMS/calling setup to enable one-tap Call.' });

  const r = await bridgeCall({ ownerPhone: company.owner_phone, leadId: lead.id, fromNumber: company.twilio_number });
  return Response.json(r.ok ? { ok: true } : { ok: false, reason: r.reason });
}
