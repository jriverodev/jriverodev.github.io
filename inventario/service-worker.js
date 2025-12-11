const CACHE_NAME = 'inventario-v1.0';
const urlsToCache = [
  '/inventario/',
  '/inventario/index.html',
  '/inventario/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache abierto');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Eliminando cache antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) return response;
        const fetchRequest = event.request.clone();
        return fetch(fetchRequest).then(response => {
          if (!response || response.status !== 200 || response.type !== 'basic') return response;
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          return response;
        }).catch(() => {
          if (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')) {
            return caches.match('/inventario/');
          }
        });
      })
  );
});

self.addEventListener('sync', event => {
  if (event.tag === 'sync-data') {
    console.log('Sincronizando datos en background...');
  }
});

self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'Notificación',
    icon: '/inventario/icons/icon-192x192.png',
    badge: '/inventario/icons/icon-192x192.png',
    vibrate: [200, 100, 200],
    data: { dateOfArrival: Date.now(), primaryKey: '2' }
  };
  event.waitUntil(self.registration.showNotification('Sistema de Inventario', options));
});
