const CACHE_NAME = 'ttocc-flota-v10';

const ASSETS = [
  './',
  './index.html',
  './panel.html',
  './visor.html',
  './patio.html',
  './form-talleres.html',
  './form-flota.html',
  './visor-talleres.html',
  './visor-flota.html',
  './manifest.json',
  './manifest-panel.json',
  './manifest-visor.json',
  './js/app.js',
  './js/panel.js',
  './js/visor.js',
  './js/form-talleres.js',
  './js/form-flota.js',
  './js/visor-talleres.js',
  './js/visor-flota.js',
  './js/ui.js',
  './js/tema.js',
  './js/libs/browser@4.js',
  './css/fontawesome/all.min.css',
  './js/chart.js',
  './js/xlsx.full.min.js',
  './css/photoswipe.css'
];

// Instalación
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        ASSETS.map(asset => cache.add(asset).catch(err => console.warn(`SW: No se pudo precargar ${asset}:`, err)))
      );
    })
  );
  self.skipWaiting();
});

// Activación y limpieza de cachés antiguas
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Intercepción de peticiones (GET local o CDN)
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  
  // Evitar interceptar llamadas a la API de Google Apps Script o Supabase API
  if (e.request.url.includes('script.google.com') || e.request.url.includes('supabase.co')) return;

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      const fetchPromise = fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, responseClone));
        }
        return networkResponse;
      }).catch((err) => {
        if (cachedResponse) return cachedResponse;
        throw err;
      });

      return cachedResponse || fetchPromise;
    })
  );
});
