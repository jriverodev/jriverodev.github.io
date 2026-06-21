const CACHE_NAME = 'delivery-pwa-v1';

// Archivos estáticos y librerías CDN que se guardarán para carga instantánea
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './driver.html',
  './manifest.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// 1. Evento de Instalación: Guarda los archivos esenciales en la caché del teléfono
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cacheando archivos estáticos y CDNs...');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// 2. Evento de Activación: Limpia cachés antiguas si actualizas la app en el futuro
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Borrando caché antigua:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Evento Fetch: Intercepta las peticiones para servir desde caché (excepto Supabase)
self.addEventListener('fetch', (event) => {
  // CRUCIAL: No interceptar ni cachear nada que vaya a Supabase (auth, realtime, base de datos)
  if (event.request.url.includes('supabase.co')) {
    return fetch(event.request);
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Si está en caché lo devuelve, si no, lo busca en internet
        return cachedResponse || fetch(event.request);
      })
  );
});

