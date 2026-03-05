/**
 * Cities of Light — Service Worker
 * Cache-first for static assets, network-first for API/WS.
 */

const CACHE_NAME = 'cities-v1';

const PRECACHE = [
  '/',
  '/manifest.json',
];

// Never cache these patterns
const SKIP_CACHE = ['/ws', '/api/', '/services/', '/vault-media/', '/perception/'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Skip caching for API, WebSocket, and dynamic routes
  if (SKIP_CACHE.some((p) => url.pathname.startsWith(p))) {
    return;
  }

  // Cache-first for static assets (JS, CSS, images)
  if (url.pathname.match(/\.(js|css|png|jpg|svg|woff2?)$/)) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        return cached || fetch(e.request).then((resp) => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
          return resp;
        });
      })
    );
    return;
  }

  // Network-first for HTML
  e.respondWith(
    fetch(e.request)
      .then((resp) => {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
        return resp;
      })
      .catch(() => caches.match(e.request))
  );
});
