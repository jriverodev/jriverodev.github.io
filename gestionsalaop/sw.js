// Service Worker simple para caché de recursos (estrategia: Cache falling back to network)
const CACHE_NAME = 'transporte-app-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  // librerías externas (si el host/CSP lo permite)
  'https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css',
  'https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js',
  'https://code.jquery.com/jquery-3.6.0.min.js',
  'https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js'
];

// Install: precache app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(err => {
        console.warn('No todas las assets pudieron ser cacheadas durante install:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: limpiar caches viejos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    ))
  );
  self.clients.claim();
});

// Fetch: intentar cache, sino network. Para navegación HTML, preferir network first.
self.addEventListener('fetch', event => {
  const req = event.request;
  // Para navegación HTML: network-first
  if (req.mode === 'navigate' || (req.method === 'GET' && req.headers.get('accept') && req.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(resp => resp || caches.match('./index.html')))
    );
    return;
  }

  // Para requests estáticos: cache-first
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(networkRes => {
      // intentar cachear respuestas CORS permitidas
      if (req.method === 'GET' && networkRes && networkRes.type !== 'opaque') {
        caches.open(CACHE_NAME).then(cache => cache.put(req, networkRes.clone()));
      }
      return networkRes;
    }).catch(() => cached))
  );
});
