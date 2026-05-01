/* Meridian banking demo — service worker
 * Cache-first for the app shell so the demo works offline once installed
 * to the home screen.  Versioned cache so a new SW evicts the old one.
 */
const CACHE = 'meridian-app-v2';
const SHELL = [
  './banking.html',
  './banking-manifest.webmanifest',
  './banking-icon.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isShellPage = url.pathname.endsWith('/banking.html') || url.pathname === '/' || url.pathname.endsWith('/');

  // Network-first for the shell HTML so updates ship quickly when online,
  // but fall back to cache offline.
  if (isShellPage || req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const c = await caches.open(CACHE);
        c.put('./banking.html', fresh.clone());
        return fresh;
      } catch (_) {
        return (await caches.match('./banking.html')) || (await caches.match(req)) || Response.error();
      }
    })());
    return;
  }

  // Cache-first for everything else (icon, manifest, fonts) with background refresh.
  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) {
      // refresh in background
      fetch(req).then(res => {
        if (res && res.ok) caches.open(CACHE).then(c => c.put(req, res));
      }).catch(() => {});
      return cached;
    }
    try {
      const res = await fetch(req);
      if (res && res.ok && (url.origin === location.origin || url.origin.includes('fonts.g'))) {
        const c = await caches.open(CACHE);
        c.put(req, res.clone());
      }
      return res;
    } catch (_) {
      return Response.error();
    }
  })());
});

/* allow the page to ask the SW to update itself */
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
