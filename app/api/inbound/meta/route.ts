// Adapter B — Meta (Facebook/Instagram) Lead Ads webhook. SCAFFOLD ONLY (Phase 1
// ships the Surge-hosted form; ad adapters are wired per-customer in onboarding later).
//
// GET = Meta's subscription verification handshake (echo hub.challenge when the token
// matches META_VERIFY_TOKEN). POST = a lead webhook; TODO: verify X-Hub-Signature-256,
// call the Graph API to fetch the full lead by leadgen_id, map fields to the normalized
// shape, and POST to /api/inbound/lead with a per-company capture token + source
// 'meta_lead_ads'. Consent must come from the ad form's consent question — do NOT
// create an SMS-consented lead without it.

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const u = new URL(request.url);
  const mode = u.searchParams.get('hub.mode');
  const token = u.searchParams.get('hub.verify_token');
  const challenge = u.searchParams.get('hub.challenge') || '';
  if (mode === 'subscribe' && token && token === process.env.META_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

export async function POST() {
  // TODO(phase-1.5): verify signature, fetch lead via Graph API, normalize, forward to
  // /api/inbound/lead with the company's capture token. Acknowledge fast so Meta doesn't retry.
  return Response.json({ ok: true, note: 'meta_lead_ads adapter not yet wired' });
}
