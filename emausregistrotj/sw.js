const CACHE_NAME = 'emaus-lourdes-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/vue@3/dist/vue.global.js',
  'https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap'
];

// Evento de instalación: Almacena los recursos esenciales en la caché local
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Cacheando recursos principales');
      
      // Convertimos los strings a objetos Request configurando CORS para los externos
      const requests = ASSETS_TO_CACHE.map(url => {
        if (url.startsWith('http')) {
          // Las CDNs y Google Fonts requieren modo no-cors para ser cacheadas así
          return new Request(url, { mode: 'no-cors' });
        }
        return new Request(url);
      });

      return cache.addAll(requests);
    }).then(() => self.skipWaiting())
  );
});

// Evento de activación: Limpia versiones viejas de caché si haces actualizaciones futuras
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Eliminando caché antigua:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategias de Red / Caché: Cache First para librerías fijas y Network First con caída a caché para el resto
self.addEventListener('fetch', (e) => {
  // Ignoramos las peticiones POST (Sincronización a Google Sheets), ya que POST no se puede cachear
  if (e.request.method === 'POST') return;

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Si el recurso proviene de las CDNs, se sirve de inmediato desde la caché
        if (e.request.url.includes('cdn') || e.request.url.includes('unpkg') || e.request.url.includes('fonts')) {
          return cachedResponse;
        }
      }

      // Para los archivos locales que pueden variar, intentamos red primero, si falla va a caché
      return fetch(e.request).then((networkResponse) => {
        // NOTA: Las peticiones 'no-cors' devuelven un status 0 (respuestas opacas).
        // Para evitar que rompa al intentar actualizar la caché de las CDNs en el fetch,
        // validamos si es un estado exitoso (200) o una respuesta opaca válida (0).
        if (networkResponse.status === 200 || networkResponse.status === 0) {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, networkResponse.clone());
            return networkResponse;
          });
        }
        return networkResponse;
      }).catch(() => {
        return cachedResponse || caches.match('./index.html');
      });
    })
  );
});
