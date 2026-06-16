const CACHE_NAME = 'renombra-pdf-cache-v3';

// Listado de recursos críticos de la PWA para almacenamiento offline completo
const urlsToCache = [
  './',
  './index.html',
  './app.js',
  './js-unrar.js', // <--- Guardado local del motor RAR blindado contra bloqueos CORS
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
];

// Evento Install: Crea la caché y guarda los archivos esenciales
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Service Worker: Creando contenedor de caché y descargando recursos...');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        // Fuerza al Service Worker recién instalado a activarse inmediatamente, 
        // sin esperar a que el usuario cierre y reabra la pestaña.
        return self.skipWaiting();
      })
  );
});

// Evento Activate: Destruye versiones de caché antiguas (v1, v2, etc.) en el servidor
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('🗑️ Service Worker: Eliminando caché antigua obsoleta:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      // Le permite al Service Worker tomar el control total de las páginas activas de inmediato
      return self.clients.claim();
    })
  );
});

// Evento Fetch: Intercepta las solicitudes de red para trabajar sin conexión (Modo Offline)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // Si el archivo ya está en la caché del navegador, lo sirve al instante.
      // Si no, realiza una petición normal al servidor.
      return cachedResponse || fetch(event.request);
    })
  );
});
