// Service Worker para Reporte de Actividades (Estrategia: Cache falling back to network)
// IMPORTANTE: Cambiar el nombre de la versión cada vez que modifiques el index.html o app.js
const CACHE_NAME = 'reporte-gaita-v1.0'; 

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './app.js',
  // CDN de Tailwind y Icons (Agregados para asegurar funcionamiento offline)
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css'
];

// Install: precache app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Usamos return para asegurar que se complete antes de skipWaiting
      return cache.addAll(ASSETS).catch(err => {
        console.warn('Error en precarga de assets:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: limpiar caches viejos de la versión de Transporte
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME) {
          console.log('Borrando caché antiguo:', key);
          return caches.delete(key);
        }
      })
    ))
  );
  self.clients.claim();
});

// Fetch: Estrategia híbrida
self.addEventListener('fetch', event => {
  const req = event.request;

  // 1. Para navegación HTML: Network-first (para ver cambios rápido)
  if (req.mode === 'navigate' || (req.method === 'GET' && req.headers.get('accept')?.includes('text/html'))) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(resp => resp || caches.match('./index.html')))
    );
    return;
  }

  // 2. Para otros recursos (JS, CSS, Imágenes): Cache-first
  event.respondWith(
    caches.match(req).then(cached => {
      return cached || fetch(req).then(networkRes => {
        // Solo cachear peticiones exitosas y permitidas
        if (req.method === 'GET' && networkRes && networkRes.status === 200) {
          const copy = networkRes.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return networkRes;
      }).catch(() => {
        // Si falla el network y no hay cache, podrías retornar una imagen offline aquí
        return cached;
      });
    })
  );
});
                                 
