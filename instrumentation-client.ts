// Sentry — browser/client init (captures client-side exceptions). DORMANT until
// NEXT_PUBLIC_SENTRY_DSN is set, production only. No Session Replay (privacy + cost).
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  sendDefaultPii: false,
});

// Lets Sentry tie navigations to client errors (App Router router transitions).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
