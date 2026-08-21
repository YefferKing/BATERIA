/**
 * SERVICE WORKER - CACHÉ OFFLINE COMPLETO
 * Permite que la aplicación cargue y funcione sin conexión a internet.
 */

const CACHE_NAME = 'bateria-offline-v104';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/chart.js',
  './js/db.js',
  './js/auth.js',
  './js/app.js',
  './icons/icon-192.svg',
  './icons/icon-512.svg'
];

// Instalación y almacenamiento en caché inicial de los archivos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Guardando recursos en caché offline...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activación y limpieza de versiones antiguas de caché
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[ServiceWorker] Eliminando caché antigua:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Estrategia Network First para recursos de la app con fallback a Caché offline
self.addEventListener('fetch', (event) => {
  // Ignorar peticiones que no sean GET o que sean a endpoints de la API
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Si la respuesta de red es válida, clonar y actualizar la caché en segundo plano
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Si no hay red (offline) o falla el fetch, responder con lo que tengamos en caché
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback para navegación HTML
          if (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')) {
            return caches.match('./index.html');
          }
        });
      })
  );
});
