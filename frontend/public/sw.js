const CACHE_NAME = 'notarychain-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

const API_CACHE = 'notarychain-api-v1';
const CERT_CACHE = 'notarychain-certs-v1';

// Install — cache shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME && k !== API_CACHE && k !== CERT_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch — network-first for API, cache-first for static
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Certificate PDFs — cache for offline viewing
  if (url.pathname.includes('/certificate') && request.method === 'GET') {
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

  // API calls — network first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    if (request.method !== 'GET') return;
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

  // Static assets — cache first
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});

// Push notifications
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

// Notification click
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
