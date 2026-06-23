const CACHE_NAME = "tto-flota-cache-v1";
const ASSETS = [
  "index.html",
  "panel.html",
  "visor.html",
  "js/app.js",
  "js/panel.js",
  "js/visor.js",
  "assets/icon-512.png",
  "assets/icon-192.png",
  "manifest.json"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener("activate", (e) => {
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

self.addEventListener("fetch", (e) => {
  // Ignorar peticiones que van a la API de Google Sheets para que no fallen las consultas vivas
  if (e.request.url.includes("script.google.com")) {
    return;
  }
  
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request);
    })
  );
});

