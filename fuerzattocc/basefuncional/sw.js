// Nombre del contenedor de caché (puedes cambiar el número de versión si haces cambios grandes)
const CACHE_NAME = 'sistema-transporte-v1';

// Listado de archivos locales que el Service Worker congelará para trabajar Offline
const assetsToCache = [
  './',
  './index.html',
  './css/bootstrap.min.css',
  './css/tabulator_bootstrap5.min.css',
  './js/bootstrap.bundle.min.js',
  './js/dexie.js',
  './js/xlsx.full.min.js',
  './js/tabulator.min.js',
  './js/app.min.js'
];

// 1. EVENTO INSTALL: Se ejecuta la primera vez que se abre la app. Descarga y guarda los archivos en caché.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 [Service Worker] Almacenando recursos críticos en caché local...');
        return cache.addAll(assetsToCache);
      })
      .then(() => self.skipWaiting()) // Fuerza al SW a activarse inmediatamente
  );
});

// 2. EVENTO ACTIVATE: Limpia versiones viejas de caché si es que cambias el CACHE_NAME a futuro.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('🗑️ [Service Worker] Eliminando caché antigua:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim()) // Toma el control de la app inmediatamente
  );
});

// 3. EVENTO FETCH: Intercepta las peticiones. Si el archivo está en caché, lo sirve al instante sin usar internet.
self.addEventListener('fetch', (event) => {
  // Solo interceptar peticiones locales (evita problemas con extensiones del navegador)
  if (!event.request.url.startsWith(self.location.origin) && !event.request.url.startsWith('file://')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Si el archivo está en el caché, lo devuelve (¡Inmediato y offline!)
        if (response) {
          return response;
        }

        // Si por alguna razón no estaba en caché (ej. una actualización), intenta buscarlo en la red
        return fetch(event.request).then((networkResponse) => {
          // Si la respuesta es válida, opcionalmente podrías guardarla en caliente
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        });
      }).catch(() => {
        // Aquí podrías retornar un mensaje de error si fallara todo, 
        // pero como es una SPA localhouse, con lo anterior basta.
      })
  );
});