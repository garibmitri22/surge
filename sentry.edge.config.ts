// Sentry — edge runtime init (proxy.ts / edge routes). Same dormancy rules as the
// server config: only active when NEXT_PUBLIC_SENTRY_DSN is set, in production.
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
});
