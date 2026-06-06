'use client';

// App Router global error boundary — catches client-side render crashes, reports them
// to Sentry (no-op until the DSN is set), and shows a calm recovery screen instead of
// a white page. Must render its own <html>/<body> (it replaces the root layout).
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#0b0b0f', color: '#e5e7eb', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '32px', maxWidth: '420px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Something went wrong</h2>
          <p style={{ fontSize: '14px', color: '#9ca3af', lineHeight: 1.6, marginBottom: '20px' }}>
            We hit an unexpected error and the team has been notified. Try reloading — if it keeps happening, give it a minute.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: '10px', padding: '11px 20px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
