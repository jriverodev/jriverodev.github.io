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
  './js/app.js',
  './js/panel.js',
  './js/visor.js',
  './js/form-talleres.js',
  './js/form-flota.js',
  './js/visor-talleres.js',
  './js/visor-flota.js',
  './js/ui.js',
  './js/tema.js',
  './js/auth-gatekeeper.js',
  './js/header-led.js',
  './js/BottomNav.js',
  './js/roles.js',
  './js/profile-header.js',
  './js/supabase-client.js',
  './js/supabase-sync.js',
  './js/sync-manager.js',
  './js/libs/browser@4.js',
  './css/fontawesome/all.min.css',
  './css/modals-layering.css',
  './js/chart.js',
  './js/xlsx.full.min.js',
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
