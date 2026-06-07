import { createSupabaseServerClient } from '@/lib/supabase-server';
import { verifyToken, appBaseUrl } from '@/lib/sign.mjs';
import { notifyOwner } from '@/lib/email.mjs';

// Booking submit — the hosted interest page (app/book/[token]) posts here. Public, no
// session. The [token] segment is EITHER a short opaque code (new links) OR a legacy
// signed HMAC token (already-sent links) — we accept both. Records the booking via a
// SECURITY-DEFINER RPC (status → 'meeting' + booked_at, never a downgrade), and fires
// the stronger owner notification on the real transition. Never throws to the prospect.

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let body: { name?: string; email?: string; timePref?: string };
  try { body = await req.json(); } catch { body = {}; }
  const name = (body.name || '').toString().slice(0, 200).trim();
  const email = (body.email || '').toString().slice(0, 200).trim();
  const timePref = (body.timePref || '').toString().slice(0, 200).trim();

  const supabase = await createSupabaseServerClient();

  // Resolve the lead/company from either a short code or a legacy signed token.
  let leadId: string | undefined, companyId: string | undefined;
  const payload = verifyToken(token);
  if (payload) {
    leadId = payload.l; companyId = payload.c;
  } else {
    const { data } = await supabase.rpc('resolve_tracked_link', { p_code: token });
    const link = (data ?? {}) as { ok?: boolean; lead_id?: string; company_id?: string };
    if (link.ok) { leadId = link.lead_id; companyId = link.company_id; }
  }
  if (!leadId || !companyId) return Response.json({ ok: false, reason: 'bad_token' }, { status: 400 });

  try {
    const { data, error } = await supabase.rpc('register_booking', {
      p_lead: leadId, p_company: companyId, p_name: name, p_email: email, p_time_pref: timePref,
    });
    const r = (data ?? {}) as {
      ok?: boolean; newly_booked?: boolean; business_name?: string; owner_email?: string | null;
    };
    if (error || !r.ok) return Response.json({ ok: false, reason: 'not_recorded' }, { status: 400 });

    if (r.newly_booked && r.owner_email) {
      const base = appBaseUrl();
      const biz = r.business_name || 'A prospect';
      await notifyOwner({
        to: r.owner_email,
        subject: `Aria: ${biz} just booked a meeting 🎉`,
        text:
          `${biz} just booked a meeting with you${name ? ` (${name}${email ? `, ${email}` : ''})` : ''}.` +
          `${timePref ? ` They prefer: ${timePref}.` : ''}\n\n` +
          `This is the one that matters — they're at the top of your pipeline: ${base}/leads\n\n— Aria`,
        html:
          `<p><strong>${biz}</strong> just booked a meeting with you${name ? ` (${name}${email ? `, ${email}` : ''})` : ''}.` +
          `${timePref ? ` They prefer: <strong>${timePref}</strong>.` : ''}</p>` +
          `<p>This is the one that matters — <a href="${base}/leads">see them at the top of your pipeline →</a></p><p>— Aria</p>`,
      });
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, reason: 'error' }, { status: 500 });
  }
}
