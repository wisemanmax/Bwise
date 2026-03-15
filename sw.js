const CACHE_NAME = 'bwise-v1';
const OFFLINE_URL = '/offline.html';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/assets/style.css',
  '/assets/script.js',
  '/assets/icon-192.svg',
  '/assets/icon-512.svg',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.destination === 'document') {
            return caches.match(OFFLINE_URL);
          }
          return new Response('', { status: 408, statusText: 'Offline' });
        });
      })
  );
});
