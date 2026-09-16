const CACHE_NAME = 'siagop-movil-v19';

const ASSETS = [
  './',
  './index.html',
  './panel.html',
  './visor.html',
  './patio.html',
  './form-talleres.html',
  './form-flota.html',
  './visor-talleres.html',
  './visor-flota.html',
  './registro-organizacion.html',
  './admin.html',
  './manifest.json',
  './manifest-panel.json',
  './manifest-visor.json',
  './dist/app.js',
  './dist/panel.js',
  './dist/visor.js',
  './dist/form-talleres.js',
  './dist/form-flota.js',
  './dist/visor-talleres.js',
  './dist/visor-flota.js',
  './dist/ui.js',
  './dist/tema.js',
  './dist/auth-gatekeeper.js',
  './dist/header-led.js',
  './dist/BottomNav.js',
  './dist/roles.js',
  './dist/profile-header.js',
  './dist/supabase-client.js',
  './dist/supabase-sync.js',
  './dist/sync-manager.js',
  './dist/libs/browser@4.js',
  './css/fontawesome/all.min.css',
  './css/modals-layering.css',
  './dist/chart.js',
  './dist/xlsx.full.min.js',
  './css/photoswipe.css'
];

// Instalación con precarga tolerante a fallos
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        ASSETS.map(asset => cache.add(asset).catch(err => console.warn(`SW: No se pudo precargar ${asset}:`, err)))
      );
    })
  );
  self.skipWaiting();
});

// Activación y purga de cachés anteriores
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Estrategia Stale-While-Revalidate para recursos estáticos y exclusión de apis dinámicas
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  
  // Excluir de caché llamadas a Google Apps Script, Supabase Rest/RPC o Supabase Storage dinámico
  if (e.request.url.includes('script.google.com') || e.request.url.includes('supabase.co')) return;

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      const fetchPromise = fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, responseClone));
        }
        return networkResponse;
      }).catch((err) => {
        if (cachedResponse) return cachedResponse;
        throw err;
      });

      return cachedResponse || fetchPromise;
    })
  );
});
