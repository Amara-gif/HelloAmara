// My Platform service worker: offline app shell, no third-party origins.
// Bump CACHE_VERSION whenever an app-shell file changes. The page shows the
// "New version available, reload" toast while this worker waits to activate.
const CACHE_VERSION = 'v1';
const CACHE_PREFIX = 'my-platform-shell-';
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './styleguide.html',
  './manifest.webmanifest',
  './assets/favicon.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/css/tokens.css',
  './assets/css/components.css',
  './assets/js/accounts.js',
  './assets/js/app.js',
  './assets/js/chart.js',
  './assets/js/data.js',
  './assets/js/db.js',
  './assets/js/demo-data.js',
  './assets/js/icons.js',
  './assets/js/nav-badge.js',
  './assets/js/pwa.js',
  './assets/js/routes.js',
  './assets/js/schedule.js',
  './assets/js/styleguide.js',
  './assets/js/task-form.js',
  './assets/js/ui.js',
  './assets/js/views.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => (
          (await caches.match(request))
          || (await caches.match('./index.html'))
          || (await caches.match('./'))
        ))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
