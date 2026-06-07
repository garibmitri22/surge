import { createSupabaseServerClient } from '@/lib/supabase-server';
import { appBaseUrl } from '@/lib/sign.mjs';
import { registerClickAndDestination } from '@/lib/email.mjs';

// Short tracked CTA redirect — the warm signal, served from a clean URL (surgehq.io/r/<code>
// instead of a phishy ~180-char token path). A prospect clicks the per-lead link in an
// outbound email and lands here (public, no session). We resolve the opaque code →
// {lead, company} via the anon-safe resolve_tracked_link RPC, then run the SAME shared
// click logic as the legacy route (register_link_click + owner ping + booking_url / {book}
// fallback). Unknown/invalid codes redirect home rather than erroring — never leak why.

export const dynamic = 'force-dynamic';

function redirect(url: string) {
  return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'no-store' } });
}

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const base = appBaseUrl();

  const supabase = await createSupabaseServerClient();
  try {
    const { data, error } = await supabase.rpc('resolve_tracked_link', { p_code: code });
    const link = (data ?? {}) as { ok?: boolean; lead_id?: string; company_id?: string };
    if (error || !link.ok || !link.lead_id || !link.company_id) return redirect(base);

    const dest = await registerClickAndDestination(supabase, {
      base, leadId: link.lead_id, companyId: link.company_id, bookFallback: `${base}/book/${code}`,
    });
    return redirect(dest ?? base);
  } catch {
    return redirect(base);
  }
}
