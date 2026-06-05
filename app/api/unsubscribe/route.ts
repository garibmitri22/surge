import { createSupabaseServerClient } from '@/lib/supabase-server';

// Public, no-auth unsubscribe. Recipients hit this from the footer link (GET) or via
// one-click List-Unsubscribe-Post (POST). The email_unsubscribe RPC is SECURITY
// DEFINER + granted to anon, so it adds the suppression without exposing any data.
// Honoring this automatically (not just in persona copy) is the CAN-SPAM requirement.

function page(title: string, body: string) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${title}</title>` +
    `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:80px auto;padding:0 24px;text-align:center;color:#111827">` +
    `<h1 style="font-size:20px;font-weight:800">${title}</h1>` +
    `<p style="font-size:14px;color:#6b7280;line-height:1.6">${body}</p></div>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

async function suppress(token: string): Promise<boolean> {
  if (!token) return false;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('email_unsubscribe', { p_token: token });
  return !error && data === true;
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') || '';
  const ok = await suppress(token);
  return ok
    ? page('You’re unsubscribed', 'You won’t receive any more emails from us. Sorry for the interruption.')
    : page('Link expired', 'We couldn’t process that unsubscribe link. If you keep hearing from us, reply with “unsubscribe” and we’ll remove you.');
}

// One-click (RFC 8058): mail clients POST here. Always 200 so the client shows success.
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get('token') || '';
  await suppress(token);
  return new Response(null, { status: 200 });
}
