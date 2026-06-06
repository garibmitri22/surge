import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Next.js 16 renamed Middleware to Proxy. This runs before every matched
// request: it refreshes the Supabase session cookie and gates access.

// Routes reachable without being signed in. /legal/* are the public Terms/Privacy
// pages; /api/unsubscribe must be reachable by email RECIPIENTS (always anonymous).
// /api/cron/* authenticates via CRON_SECRET (not a session), so the proxy must let
// it through — otherwise the scheduler gets redirected to /login and never runs.
// PWA assets (manifest, service worker, offline page, icons) must be public too, so
// they load on the landing page and for logged-out visitors.
const PUBLIC_PATHS = [
  '/login', '/signup', '/landing', '/legal', '/api/unsubscribe', '/auth/confirm', '/api/cron',
  '/api/debug-error',
  // Warm-signal: prospects (anonymous) hit the tracked-CTA redirect, the hosted
  // interest page, and its booking submit. All must be reachable without a session.
  '/api/r', '/book', '/api/book',
  '/manifest.webmanifest', '/sw.js', '/offline.html', '/icons', '/apple-icon', '/icon',
];

function isPublic(path: string): boolean {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + '/'));
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: do not run code between creating the client and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Not signed in and trying to reach a protected route → send to login.
  if (!user && !isPublic(path)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Already signed in but on an auth page → send to dashboard.
  if (user && (path === '/login' || path === '/signup')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Run on everything except Next internals and static asset files.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
