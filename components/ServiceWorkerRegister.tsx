'use client';

import { useEffect } from 'react';

// Registers the PWA service worker once on the client. Does NOT request notification
// permission or subscribe to push (that's a later, opt-in Level-4 step).
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* non-fatal */ });
    }
  }, []);
  return null;
}
