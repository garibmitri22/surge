import type { Database } from '@/lib/supabase';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { parseContacts, segmentOf, consentChannelsFor, dedupeKey } from '@/lib/reactivation.mjs';

type LeadInsert = Database['public']['Tables']['leads']['Insert'];

// Import the owner's existing list as reactivation leads. Owner-authenticated (RLS
// scopes the writes). Dedupes against the company's existing leads (email/phone/name),
// stamps origin='reactivation', the per-channel consent basis, and the relationship
// facts that make a past-customer message land. Not metered (import isn't AI work).

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  let body: { csv?: string };
  try { body = await request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }

  const { contacts, error } = parseContacts(body.csv || '');
  if (error) return Response.json({ ok: false, reason: 'parse_error', message: error }, { status: 400 });
  if (contacts.length === 0) return Response.json({ ok: false, reason: 'empty', message: 'No contacts with an email or phone found.' }, { status: 400 });

  const { data: company } = await supabase.from('companies').select('id').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!company) return new Response('Complete onboarding first', { status: 400 });

  // Dedupe against existing leads (any origin) by email/phone/business_name.
  const { data: existing } = await supabase.from('leads').select('email, phone, business_name').eq('company_id', company.id);
  const seen = new Set<string>();
  for (const l of existing ?? []) {
    if (l.email) seen.add(dedupeKey({ email: l.email, phone: '', name: '' }));
    if (l.phone) seen.add(dedupeKey({ email: '', phone: l.phone, name: '' }));
    if (l.business_name) seen.add(dedupeKey({ email: '', phone: '', name: l.business_name }));
  }

  const today = new Date().toISOString().slice(0, 10);
  const rows: LeadInsert[] = [];
  let skipped = 0;
  const segments: Record<string, number> = {};
  const batchSeen = new Set<string>();

  for (const c of contacts) {
    const key = dedupeKey(c);
    if (!key || seen.has(key) || batchSeen.has(key)) { skipped++; continue; }
    batchSeen.add(key);
    const seg = segmentOf(c);
    segments[seg] = (segments[seg] ?? 0) + 1;
    const channels = consentChannelsFor(c);
    const amount = c.amount ? parseFloat(String(c.amount).replace(/[^0-9.]/g, '')) : null;
    rows.push({
      company_id: company.id,
      business_name: c.name || c.email || c.phone || 'Past contact',
      vertical: 'other',
      source_url: 'reactivation',
      score: 0,
      score_reasons: {},
      status: 'qualified',
      origin: 'reactivation',
      source: 'reactivation_import',
      email: c.email,
      phone: c.phone,
      consent_channels: channels,
      consent_at: today,
      consent_text: `Reactivation import — established business relationship (email). SMS/call consent: ${c.smsConsent ? 'yes' : 'no'}.`,
      last_seen_at: /^\d{4}-\d{2}-\d{2}/.test(c.lastSeen || '') ? c.lastSeen : null,
      past_value: amount != null && !Number.isNaN(amount) ? amount : null,
      relationship: [c.relationship, c.status].filter(Boolean).join(' · ') || null,
      notes: `Segment: ${seg}`,
      next_action: 'Reactivation outreach',
      next_action_at: today,
    });
  }

  let created = 0;
  if (rows.length > 0) {
    const { data: ins, error: insErr } = await supabase.from('leads').insert(rows).select('id');
    if (insErr) return Response.json({ ok: false, reason: 'insert_failed', message: insErr.message }, { status: 400 });
    created = ins?.length ?? 0;
  }

  return Response.json({ ok: true, created, skipped, segments, total: contacts.length });
}
