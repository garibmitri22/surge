// Sentry — server runtime init (ops error alerting). DORMANT until
// NEXT_PUBLIC_SENTRY_DSN is set in the environment (Mitri pastes it in Vercel), and
// only active in production, so local/dev and the sandbox build stay clean.
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1,
  sendDefaultPii: false, // scrub PII — don't ship request bodies / user data to Sentry
});
