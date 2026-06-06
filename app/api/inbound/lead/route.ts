import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { verifyCaptureToken, normalizeInboundPayload, deliverSms } from '@/lib/inbound.mjs';
import { ariaSmsReply } from '@/lib/sms-responder';

// Normalized inbound endpoint — every adapter (Surge-hosted form first; Meta/Google
// later) feeds here. Public (no session): secured by a per-company signed capture token,
// NOT open to the world. Creates the lead via the anon-safe create_inbound_lead RPC
// (consent + source stamped), then fires the speed-to-lead first text — but ONLY through
// deliverSms, which enforces consent + 10DLC + opt-out + Twilio config. With Twilio /
// 10DLC unset it cleanly no-ops (lead captured, send queued).

export const dynamic = 'force-dynamic';
const SOURCES = ['surge_form', 'meta_lead_ads', 'google_lead_form', 'click_to_call'];

export async function POST(request: Request) {
  // Accept JSON or form-encoded.
  let raw: Record<string, unknown> = {};
  const ct = request.headers.get('content-type') || '';
  try {
    if (ct.includes('application/json')) raw = await request.json();
    else { const f = await request.formData(); raw = Object.fromEntries([...f.entries()]); }
  } catch { return Response.json({ ok: false, reason: 'bad_payload' }, { status: 400 }); }

  const token = String(raw.token || '');
  const companyId = verifyCaptureToken(token);
  if (!companyId) return Response.json({ ok: false, reason: 'bad_token' }, { status: 403 });

  const source = SOURCES.includes(String(raw.source)) ? String(raw.source) : 'surge_form';
  const norm = normalizeInboundPayload(raw, source);
  if (!norm.phone && !norm.email) return Response.json({ ok: false, reason: 'no_contact' }, { status: 400 });

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;

  // Create the lead via the anon-safe definer RPC (works with no service key).
  const anon = await createSupabaseServerClient();
  const { data, error } = await anon.rpc('create_inbound_lead', {
    p_company: companyId, p_name: norm.name ?? '', p_phone: norm.phone ?? '', p_email: norm.email ?? '',
    p_consent_text: norm.consent_text ?? '', p_consent_channels: norm.consent_channels, p_consent_ip: ip ?? '', p_source: source,
  });
  const r = (data ?? {}) as { ok?: boolean; lead_id?: string; has_consent?: boolean };
  if (error || !r.ok || !r.lead_id) return Response.json({ ok: false, reason: 'create_failed' }, { status: 400 });

  // Speed-to-lead: fire the first text NOW. Needs a service-role client to read the
  // company's telephony config + write the message log without a session. If it isn't
  // wired yet, the lead is still captured and the send is simply deferred.
  let sent = false, sendReason = 'queued';
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (r.has_consent && SERVICE) {
    try {
      const svc = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, SERVICE, { auth: { persistSession: false } });
      const { data: company } = await svc.from('companies').select('*').eq('id', companyId).maybeSingle();
      const { data: lead } = await svc.from('leads').select('*').eq('id', r.lead_id).maybeSingle();
      if (company && lead) {
        const body = await ariaSmsReply(svc as never, companyId, lead, []);
        if (body) {
          const res = await deliverSms(svc, company, lead, body);
          sent = !!res.ok; sendReason = res.ok ? 'sent' : (res.reason ?? 'send_failed');
        } else { sendReason = 'compose_unavailable'; }
      }
    } catch { sendReason = 'send_error'; }
  } else if (!SERVICE) {
    sendReason = 'telephony_not_configured';
  } else if (!r.has_consent) {
    sendReason = 'no_consent';
  }

  return Response.json({ ok: true, lead_id: r.lead_id, sent, send_status: sendReason });
}
