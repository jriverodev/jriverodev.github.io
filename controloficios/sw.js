const CACHE_NAME = 'nexus-pdf-cache-v1';
const ASSETS = [
  './', // Agregado para cachear la raíz de forma segura en GitHub Pages
  'index.html',
  'manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js'
];

// Evento de Instalación
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Evento de Activación
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

// Estrategia de Cache: Cache First, luego Red
self.addEventListener('fetch', (e) => {
  // EXCLUSIÓN CRÍTICA: Si es un POST (como el envío a Sheets), ignorar por completo
  if (e.request.method === 'POST') {
    return; 
  }

  // Solo manejar peticiones estándar de recursos de la app (GET)
  if (e.request.url.includes('http')) {
    e.respondWith(
      caches.match(e.request).then((cachedResponse) => {
        return cachedResponse || fetch(e.request);
      })
    );
  }
});

// Dentro de tu sw.js (GitHub Pages)
self.addEventListener('fetch', (event) => {
  // REGLA CRÍTICA: Ignorar la API de Google Apps Script y peticiones POST
  if (event.request.url.includes('script.google.com') || event.request.method === 'POST') {
    // Esto le dice al Service Worker: "No te metas aquí, deja que vaya directo a internet"
    return; 
  }

  // Tu lógica actual para las demás peticiones (imágenes, diseño, etc.)
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    }).catch(() => {
      // Manejo de fallback offline si aplica
    })
  );
});
