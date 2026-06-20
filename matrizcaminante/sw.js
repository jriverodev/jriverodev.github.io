const CACHE_NAME = 'emaus-logistica-v2'; // Incrementamos la versión para forzar la actualización
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './db.js',
  './sync.js',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/icon?family=Material+Icons',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11',
  'https://unpkg.com/dexie@3.2.4/dist/dexie.mjs'
];

// Instalación: Guardamos los recursos críticos en el caché estático
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting()) // Fuerza al service worker a activarse de inmediato
  );
});

// Activación: Limpiamos cachés viejos de versiones anteriores
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
    }).then(() => self.clients.claim()) // Toma el control de las pestañas abiertas inmediatamente
  );
});

// Estrategia de Fetch: Network First para archivos de la app, Cache de respaldo offline
self.addEventListener('fetch', (e) => {
  // Ignorar peticiones que no sean GET o que apunten a la API de Google Sheets (subidas/descargas masivas)
  if (e.request.method !== 'GET' || e.request.url.includes('script.google.com')) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // Si la red responde, duplicamos la respuesta en el caché
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Si no hay red, buscamos el recurso en el almacenamiento local del Caché
        return caches.match(e.request);
      })
  );
});
