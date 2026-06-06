import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase';
import { validateTwilioSignature } from '@/lib/twilio.mjs';
import { isOptOut, suppressSms, deliverSms } from '@/lib/inbound.mjs';
import { ariaSmsReply } from '@/lib/sms-responder';

// Twilio inbound SMS webhook (two-way). A consumer replies → we log it, honor STOP,
// promote inbound→engaged, then Aria writes the next line in the brand voice and we
// reply through the consent chokepoint (deliverSms). Empty TwiML 200 always (we send
// via the REST API, not TwiML, so Twilio doesn't double-send). No-ops without Twilio
// config / service role.

export const dynamic = 'force-dynamic';

function twiml() {
  return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', { headers: { 'Content-Type': 'text/xml' } });
}

export async function POST(request: Request) {
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE) return twiml(); // not wired — accept + drop

  let params: Record<string, string> = {};
  try { const f = await request.formData(); params = Object.fromEntries([...f.entries()].map(([k, v]) => [k, String(v)])); } catch { return twiml(); }

  // Verify the request really came from Twilio.
  const signature = request.headers.get('x-twilio-signature') || '';
  const url = `${(process.env.NEXT_PUBLIC_APP_URL || 'https://surgehq.io').replace(/\/$/, '')}/api/inbound/sms`;
  if (!validateTwilioSignature(process.env.TWILIO_AUTH_TOKEN, url, params, signature)) {
    return new Response('Forbidden', { status: 403 });
  }

  const from = (params.From || '').trim();   // the consumer
  const to = (params.To || '').trim();        // our company number
  const body = (params.Body || '').trim();
  const sid = params.MessageSid || params.SmsSid || null;
  if (!from || !to) return twiml();

  const svc = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, SERVICE, { auth: { persistSession: false } });

  // Resolve the company by the number that was texted.
  const { data: company } = await svc.from('companies').select('*').eq('twilio_number', to).maybeSingle();
  if (!company) return twiml();

  // Most recent lead for this phone at this company.
  const { data: lead } = await svc.from('leads')
    .select('*').eq('company_id', company.id).eq('phone', from).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!lead) return twiml();

  // Log their inbound message.
  await svc.from('lead_messages').insert({ company_id: company.id, lead_id: lead.id, direction: 'inbound', channel: 'sms', body, twilio_sid: sid });

  // Opt-out (STOP) → suppress + stop. Never reply.
  if (isOptOut(body)) {
    await suppressSms(svc, company.id, from);
    await svc.from('leads').update({ status: 'disqualified', next_action: 'Opted out (STOP)', next_action_at: new Date().toISOString() }).eq('id', lead.id).eq('company_id', company.id);
    return twiml();
  }

  // Their reply promotes inbound → engaged.
  if (lead.status === 'inbound') {
    await svc.from('leads').update({ status: 'engaged' }).eq('id', lead.id).eq('company_id', company.id);
    lead.status = 'engaged';
  }

  // Aria writes the next line from the full thread, then we reply through the gate.
  const { data: thread } = await svc.from('lead_messages')
    .select('direction, body').eq('lead_id', lead.id).order('created_at', { ascending: true });
  const reply = await ariaSmsReply(svc as never, company.id, lead, thread ?? []);
  if (reply) await deliverSms(svc, company, lead, reply);

  return twiml();
}
