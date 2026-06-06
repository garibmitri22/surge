// Surge service worker — minimal, for installability + an offline fallback.
// Strategy: cache-first for immutable static assets + our generated icons;
// NETWORK-FIRST for navigations (never serve stale auth/data) with an offline page.
// Push is scaffolded but OFF — we never subscribe or request permission yet.
const CACHE = 'surge-v1';
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/icons/192', '/icons/512'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Cache-first for hashed static assets + generated icons (safe to cache).
  if (url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/icons')) {
    event.respondWith(
      caches.match(req).then((hit) =>
        hit || fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
      )
    );
    return;
  }

  // Network-first for page navigations; fall back to the offline page when offline.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }
  // Everything else (API/data): straight to network, never cached (no stale data).
});

// --- Push: capable but DORMANT. We do not subscribe or request permission yet.
// TODO (Level 4): Atlas morning-brief push. When enabled, subscribe via
// pushManager on the client and send from the server; this listener renders it.
self.addEventListener('push', (event) => {
  if (!event.data) return; // nothing is sent yet — no-op
  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || 'Surge', { body: data.body || '', icon: '/icons/192' })
    );
  } catch {
    /* ignore malformed payloads */
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow('/dashboard'));
});
