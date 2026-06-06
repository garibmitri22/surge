import { createSupabaseServerClient } from '@/lib/supabase-server';
import { captureToken } from '@/lib/inbound.mjs';
import { appBaseUrl } from '@/lib/sign.mjs';

// Owner-only: mint this company's hosted capture-form URL (the link they paste into an
// ad). The signed token binds the form to THIS company. Authenticated (not public).
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  const { data: company } = await supabase.from('companies').select('id').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!company) return Response.json({ ok: false, reason: 'no_company' }, { status: 400 });
  try {
    const url = `${appBaseUrl()}/capture/${captureToken(company.id)}`;
    return Response.json({ ok: true, url });
  } catch {
    return Response.json({ ok: false, reason: 'signing_unavailable' }, { status: 500 });
  }
}
