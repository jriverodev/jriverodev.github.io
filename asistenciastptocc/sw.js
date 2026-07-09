const CACHE_NAME = 'ttocc-asistp-v1';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11',
  'https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap'
];

// Instalar el Service Worker y almacenar archivos en caché
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Activar y limpiar cachés antiguas
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
});

// Interceptar peticiones para servir desde la caché si no hay internet
self.addEventListener('fetch', (e) => {
  // No cachear peticiones POST o URLs de Google Sheets para evitar conflictos con la sincronización
  if (e.request.method !== 'GET' || e.request.url.includes('script.google.com')) {
    return;
  }
  
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request);
    })
  );
});
