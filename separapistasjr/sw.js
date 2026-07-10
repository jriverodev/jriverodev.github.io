// sw.js
const CACHE_NAME = 'guitar-separator-v1';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './db.js'
];

// Instalar Service Worker y guardar la interfaz en caché
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activar y limpiar cachés viejos
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

// Estrategia Cache-First para los assets estáticos de la App
self.addEventListener('fetch', (e) => {
  // Evitar interceptar llamadas externas a Hugging Face para que el pipeline de Transformers.js maneje su propia caché interna
  if (e.request.url.includes('huggingface.co') || e.request.url.includes('unpkg.com')) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request);
    })
  );
});
