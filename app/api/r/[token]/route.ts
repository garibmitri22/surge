import { createSupabaseServerClient } from '@/lib/supabase-server';
import { verifyToken, appBaseUrl } from '@/lib/sign.mjs';
import { registerClickAndDestination } from '@/lib/email.mjs';

// LEGACY tracked CTA redirect — kept working for links already sent (back-compat). New
// outbound uses the short /r/[code] route. A prospect clicks the signed per-lead link in
// an outbound email and lands here (public, no session). We verify the HMAC token, then
// run the SAME shared click logic (register_link_click RPC + owner ping + booking_url /
// {book} fallback). Bad/tampered tokens redirect home rather than erroring — never leak why.

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
  try {
    const dest = await registerClickAndDestination(supabase, {
      base, leadId: payload.l, companyId: payload.c, bookFallback: `${base}/book/${token}`,
    });
    return redirect(dest ?? base);
  } catch {
    return redirect(base);
  }
}
