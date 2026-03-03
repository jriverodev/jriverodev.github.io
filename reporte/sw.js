// Service Worker: Reporte Operativo OUM - División Lago
const CACHE_NAME = 'oum-division-lago-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon.png',
  'https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css',
  'https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js',
  'https://code.jquery.com/jquery-3.6.0.min.js',
  'https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11'
];

// Instalación: Guardar en caché el "App Shell"
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Caché OUM abierto exitosamente');
      return cache.addAll(ASSETS).catch(err => {
        console.warn('Algunos recursos externos no pudieron cachearse (esto es normal si hay bloqueo CORS):', err);
      });
    })
  );
  self.skipWaiting();
});

// Activación: Limpieza de versiones antiguas para evitar conflictos
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

// Estrategia de Fetch: Network-first para datos actualizados, Cache-first para archivos estáticos
self.addEventListener('fetch', event => {
  const req = event.request;

  // 1. Para el HTML principal: Priorizar red para asegurar que el reporte sea el último guardado
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

  // 2. Para librerías (JS/CSS) e iconos: Cache-first (ahorro de datos y velocidad)
  event.respondWith(
    caches.match(req).then(cached => {
      return cached || fetch(req).then(networkRes => {
        // Solo cacheamos respuestas válidas y métodos GET
        if (req.method === 'GET' && networkRes && networkRes.status === 200) {
          const copy = networkRes.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return networkRes;
      }).catch(() => {
        // Fallback en caso de que falle la red y no esté en caché
        if (req.url.includes('bootstrap-icons')) {
            return new Response('', { status: 404 }); 
        }
      });
    })
  );
});
