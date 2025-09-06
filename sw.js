/* Simple offline-first service worker for totaldays */
const CACHE_VERSION = 'v2025-09-06';
const CACHE_NAME = `totaldays-${CACHE_VERSION}`;

const CORE_ASSETS = [
  './',
  './index.html',
  './app.html',
  './icon.png',
  './manifest.webmanifest'
];

// Optional: cache CDN dependencies after first load
const RUNTIME_CACHE = 'runtime';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Clean old caches
      const names = await caches.keys();
      await Promise.all(names.filter(n => n !== CACHE_NAME && n !== RUNTIME_CACHE).map(n => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Navigation requests: try network first, fall back to cache
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          // Update cache in background
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, fresh.clone());
          return fresh;
        } catch (err) {
          // Fallback to cached app shell
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match('./app.html')) || (await cache.match('./index.html')) || Response.error();
        }
      })()
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req, { credentials: 'omit' });
        // Cache opaque cross-origin too (CDN scripts/styles)
        cache.put(req, res.clone());
        return res;
      } catch (e) {
        return cached || Response.error();
      }
    })()
  );
});

