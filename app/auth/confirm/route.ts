import { type EmailOtpType } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

// Email-confirmation landing. The confirmation link in the signup email points here
// with a token_hash; we verify it (which sets the session cookie) and send the new
// user into onboarding. Public route (they have no session until this runs).
// Supabase dashboard side (Mitri): flip "Confirm email" ON, set Site URL to the prod
// domain, allow the redirect URLs, and point the "Confirm signup" email template at
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/onboarding
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/onboarding';

  if (token_hash && type) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  return NextResponse.redirect(new URL('/login?error=confirm', origin));
}
