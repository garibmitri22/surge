// Adapter C — Google Lead Form Extensions webhook. SCAFFOLD ONLY (wired per-customer
// in onboarding later; Phase 1 ships the Surge-hosted form).
//
// Google POSTs a JSON lead with a `google_key` shared secret you configure on the form.
// TODO(phase-1.5): verify google_key === GOOGLE_LEAD_KEY, map user_column_data to the
// normalized shape, and POST to /api/inbound/lead with a per-company capture token +
// source 'google_lead_form'. Consent comes from the form's consent column — never
// SMS-consent a lead without it.

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: { google_key?: string } = {};
  try { body = await request.json(); } catch { /* ignore */ }
  if (!process.env.GOOGLE_LEAD_KEY || body.google_key !== process.env.GOOGLE_LEAD_KEY) {
    return new Response('Forbidden', { status: 403 });
  }
  // TODO(phase-1.5): normalize user_column_data → forward to /api/inbound/lead.
  return Response.json({ ok: true, note: 'google_lead_form adapter not yet wired' });
}
