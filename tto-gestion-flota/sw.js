const CACHE_NAME = 'ttocc-flota-v2';

const ASSETS = [
  './',
  './index.html',
  './panel.html',
  './visor.html',
  './manifest.json',
  './manifest-panel.json',
  './manifest-visor.json',
  './js/app.js',
  './js/panel.js',
  './js/visor.js',
  './js/ui.js',
  './js/tema.js',
  // CDN externas utilizadas por tu app
  'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/photoswipe/5.4.2/photoswipe.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/photoswipe/5.4.2/photoswipe.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/photoswipe/5.4.2/photoswipe-lightbox.umd.min.js'
];

// Instalación
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
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
  
  // Evitar interceptar llamadas a la API de Google Apps Script
  if (e.request.url.includes('script.google.com')) return;

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      const fetchPromise = fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, responseClone));
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
