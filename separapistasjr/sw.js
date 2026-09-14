const CACHE_NAME = 'separapistas-v2';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './audioPlayer.js',
  './db.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Instalar Service Worker y precachear los recursos de la interfaz
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Limpieza de cachés antiguas en la activación
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Estrategia Stale-While-Revalidate para recursos locales
self.addEventListener('fetch', (e) => {
  // Evitar interceptar peticiones a la API de Hugging Face o CDNs externos
  if (
    e.request.url.includes('huggingface.co') ||
    e.request.url.includes('hf.space') ||
    e.request.url.includes('cdn.jsdelivr.net') ||
    e.request.url.includes('unpkg.com')
  ) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      const fetchPromise = fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && e.request.method === 'GET') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, responseToCache));
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
