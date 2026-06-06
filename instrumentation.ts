// Next.js instrumentation entrypoint. Loads the right Sentry runtime config and wires
// the App Router's onRequestError hook so EVERY uncaught server error (route handlers,
// server components, etc.) is captured — this is the "get paged when prod breaks" path.
import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
