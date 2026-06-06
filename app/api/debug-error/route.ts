// Deliberate error trigger — used ONCE to confirm Sentry alerting fires to email in
// prod. Gated by CRON_SECRET so the public can't spam our error stream: hit
//   https://surgehq.io/api/debug-error?key=<CRON_SECRET>
// Without the right key it 404s (no hint it exists). The thrown error propagates to
// the App Router's onRequestError hook (instrumentation.ts) → Sentry → alert rule.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get('key');
  const secret = process.env.CRON_SECRET;
  if (!secret || key !== secret) {
    return new Response('Not found', { status: 404 });
  }
  throw new Error('Sentry test error — triggered intentionally via /api/debug-error to verify alerting.');
}
