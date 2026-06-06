import { createSupabaseServerClient } from '@/lib/supabase-server';
import { verifyToken, appBaseUrl } from '@/lib/sign.mjs';
import { notifyOwner } from '@/lib/email.mjs';

// Tracked CTA redirect — the warm signal. A prospect clicks the signed per-lead link
// in an outbound email and lands here (public, no session). We verify the HMAC token,
// register the click (increment + promote to warm + Lead Lifeline refresh + activity,
// all in one SECURITY-DEFINER RPC so an anon click can write without RLS), ping the
// owner on the real new→warm transition, then 302 to the destination: the customer's
// booking_url if set, else our hosted interest page. Bad/tampered tokens redirect home
// rather than erroring — never leak why.

export const dynamic = 'force-dynamic';

function redirect(url: string) {
  return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'no-store' } });
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const base = appBaseUrl();

  const payload = verifyToken(token);
  if (!payload) return redirect(base); // tampered / malformed → home, silently

  const supabase = await createSupabaseServerClient();
  let dest = `${base}/book/${token}`; // default: our hosted interest page

  try {
    const { data, error } = await supabase.rpc('register_link_click', { p_lead: payload.l, p_company: payload.c });
    const r = (data ?? {}) as {
      ok?: boolean; newly_warm?: boolean; business_name?: string;
      booking_url?: string | null; owner_email?: string | null; company_name?: string | null;
    };
    if (error || !r.ok) return redirect(base);

    if (r.booking_url && r.booking_url.trim()) dest = r.booking_url.trim();

    // Owner ping — only on the real new→warm transition, so it fires exactly once.
    if (r.newly_warm && r.owner_email) {
      const biz = r.business_name || 'A prospect';
      await notifyOwner({
        to: r.owner_email,
        subject: `Aria: ${biz} just clicked your link — they're warm`,
        text:
          `${biz} just clicked the link in your outreach — that's a real buying signal, so I moved them to Warm and lined up a same-day follow-up.\n\n` +
          `See them at the top of your pipeline: ${base}/leads\n\n— Aria`,
        html:
          `<p><strong>${biz}</strong> just clicked the link in your outreach — that's a real buying signal, so I moved them to <strong>Warm</strong> and lined up a same-day follow-up.</p>` +
          `<p><a href="${base}/leads">See them at the top of your pipeline →</a></p><p>— Aria</p>`,
      });
    }
  } catch {
    return redirect(base);
  }

  return redirect(dest);
}
