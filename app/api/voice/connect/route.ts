import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase';

// Owner-bridge TwiML. bridgeCall() (lib/twilio.mjs) rings the OWNER first; when they
// answer, Twilio fetches this TwiML, which asks "press 1 to connect to your new lead"
// and on 1 dials the lead and bridges the two humans. NO AI voice speaks to the consumer
// in Phase 1 (that's Phase 3). The call is logged to lead_messages (channel=call).

export const dynamic = 'force-dynamic';

function xml(body: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, { headers: { 'Content-Type': 'text/xml' } });
}

async function handle(request: Request) {
  const url = new URL(request.url);
  const leadId = url.searchParams.get('lead') || '';
  const digits = url.searchParams.get('Digits') || (await readDigits(request));
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!leadId || !SERVICE) return xml('<Say>This lead connection is not available.</Say><Hangup/>');

  const svc = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, SERVICE, { auth: { persistSession: false } });
  const { data: lead } = await svc.from('leads').select('id, company_id, phone, business_name').eq('id', leadId).maybeSingle();
  if (!lead?.phone) return xml('<Say>This lead has no phone number on file.</Say><Hangup/>');

  // First leg (owner answered): gather the keypress to confirm before we dial the lead.
  if (digits !== '1') {
    const action = `${(process.env.NEXT_PUBLIC_APP_URL || 'https://surgehq.io').replace(/\/$/, '')}/api/voice/connect?lead=${encodeURIComponent(leadId)}`;
    return xml(`<Gather numDigits="1" action="${action}" method="POST"><Say>Your new lead, ${escapeXml(lead.business_name || '')}, is ready. Press 1 to connect now.</Say></Gather><Say>No input received. Goodbye.</Say><Hangup/>`);
  }

  // Pressed 1 → bridge to the lead. Log the call.
  await svc.from('lead_messages').insert({ company_id: lead.company_id, lead_id: lead.id, direction: 'outbound', channel: 'call', body: 'Owner bridged a call to the lead' });
  const { data: company } = await svc.from('companies').select('twilio_number').eq('id', lead.company_id).maybeSingle();
  const callerId = company?.twilio_number ? ` callerId="${escapeXml(company.twilio_number)}"` : '';
  return xml(`<Say>Connecting you now.</Say><Dial${callerId}>${escapeXml(lead.phone)}</Dial>`);
}

async function readDigits(request: Request): Promise<string> {
  try { const f = await request.formData(); return String(f.get('Digits') || ''); } catch { return ''; }
}
function escapeXml(s: string) { return String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!)); }

export const GET = handle;
export const POST = handle;
