const CACHE_NAME = 'gestion-mtto-cache-v2'; // Incrementamos la versión del caché
const urlsToCache = [
    // Archivos locales
    'index.html',
    'sql-wasm.wasm',
    'manifest.json',
    'icon.png',
    // Archivos externos (CDN)
    'https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js'
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

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Si el recurso está en la caché, lo devolvemos desde allí
                if (response) {
                    return response;
                }
                // Si no, lo buscamos en la red
                return fetch(event.request);
            })
    );
});

// Limpiar cachés antiguos
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
