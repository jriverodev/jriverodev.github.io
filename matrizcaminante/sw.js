// Nombre del caché (cambia la versión si actualizas el diseño visual)
const CACHE_NAME = 'emaus-pwa-cache-v1';

// Los archivos mínimos e indispensables que la app necesita para existir offline
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './db.js',
  './sync.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// 1. Evento 'install': Se ejecuta la primera vez que se descarga la app
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Guardando la interfaz en caché...');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting()) // Fuerza al SW actual a activarse de una vez
  );
});

// 2. Evento 'activate': Limpia cachés antiguos de versiones previas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Borrando caché antiguo...', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim()) // Toma el control de la app inmediatamente
  );
});

// 3. Evento 'fetch': La magia offline. Intercepta las peticiones de red
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // EXCEPCIÓN CRÍTICA: No interceptar la URL de tu Google Apps Script.
  // Los datos del Sheets SIEMPRE deben intentar ir a la red mediante sync.js
  if (url.href.includes('script.google.com')) {
    return; 
  }

  // Para el resto de archivos de la interfaz (HTML, CSS, JS, Iconos):
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Si el archivo está en el caché, lo devuelve. Si no, va a internet.
      return cachedResponse || fetch(event.request).catch(() => {
        // Opcional: Aquí podrías retornar un html genérico de "Estás offline" 
        // si el recurso solicitado no está en caché y no hay red.
      });
    })
  );
});
