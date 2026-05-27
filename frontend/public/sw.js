/**
 * NotaryChain Service Worker
 *
 * BUMP `CACHE_VERSION` on every deploy to evict old caches.
 * (CRA bundles hash filenames, so static assets are version-safe by URL; but
 *  index.html is NOT hashed, so we must serve it network-first.)
 *
 * Strategy:
 *   • Navigation (HTML / `/index.html` / `/`)    → NETWORK-FIRST  (fresh HTML or fall back to cached)
 *   • Hashed static assets (/static/*)           → CACHE-FIRST    (immutable by hash)
 *   • API calls (/api/*)                         → NETWORK-FIRST  (with cache fallback for offline)
 *   • Certificate PDFs                           → CACHE-FIRST    (offline-viewable)
 *   • Everything else                            → NETWORK-FIRST
 */

// 🔁 Bump this on every deploy so old caches are evicted.
const CACHE_VERSION = 'v3-2026-05-27-r4';
const CACHE_NAME = `notarychain-shell-${CACHE_VERSION}`;
const API_CACHE = `notarychain-api-${CACHE_VERSION}`;
const CERT_CACHE = `notarychain-certs-${CACHE_VERSION}`;
const STATIC_ASSETS = ['/manifest.json'];

// ─── Install ───────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  // Activate this SW immediately on next page load; don't wait for old tabs to close.
  self.skipWaiting();
});

// ─── Activate ──────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Delete ALL caches whose name doesn't include the current CACHE_VERSION.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.endsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      );
      // Take control of all open clients (tabs) right now.
      await self.clients.claim();
      // Tell every client to reload — fixes the stale-shell blank-page problem
      // for users still on the previously-cached broken HTML.
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION });
      }
    })()
  );
});

// ─── Fetch ─────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 1) Certificate PDFs — cache-first (offline-viewable)
  if (url.pathname.includes('/certificate')) {
    event.respondWith(
      caches.open(CERT_CACHE).then((cache) =>
        fetch(request).then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        }).catch(() => cache.match(request))
      )
    );
    return;
  }

  // 2) API calls — network-first, cache fallback for offline
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      caches.open(API_CACHE).then((cache) =>
        fetch(request).then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        }).catch(() => cache.match(request))
      )
    );
    return;
  }

  // 3) Hashed static assets — cache-first (filenames include build hash, immutable)
  if (url.pathname.startsWith('/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // 4) Navigation requests + HTML + everything else → NETWORK-FIRST.
  //    This is the critical fix: never serve stale index.html.
  const isNavigation = request.mode === 'navigate' ||
                       (request.headers.get('accept') || '').includes('text/html');

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful navigation responses so we can fall back when offline.
        if (isNavigation && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((c) => c.put('/index.html', clone));
        }
        return response;
      })
      .catch(() => {
        // Offline fallback: serve cached index.html if available.
        if (isNavigation) {
          return caches.match('/index.html').then((cached) => cached || Response.error());
        }
        return caches.match(request);
      })
  );
});

// ─── Push notifications ────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'NotaryChain';
  const options = {
    body: data.body || 'Your ceremony status has been updated.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'ceremony-update',
    data: { url: data.url || '/dashboard' },
    actions: [
      { action: 'open', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── Notification click ────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
