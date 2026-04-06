/**
 * sw.js — Service Worker: cache-first strategy for PWA offline support.
 */

const CACHE_NAME = 'babyrecord-v1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/variables.css',
  './css/reset.css',
  './css/main.css',
  './css/components.css',
  './js/app.js',
  './js/router.js',
  './js/modules/db.js',
  './js/modules/baby.js',
  './js/modules/records.js',
  './js/modules/reminder.js',
  './js/modules/gdrive.js',
  './js/modules/theme.js',
  './js/components/icons.js',
  './js/components/nav.js',
  './js/components/babySelector.js',
  './js/components/modal.js',
  './js/components/toast.js',
  './js/pages/home.js',
  './js/pages/add.js',
  './js/pages/history.js',
  './js/pages/stats.js',
  './js/pages/settings.js',
  './vendor/chart.min.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET and cross-origin requests
  if (request.method !== 'GET') return;
  if (!request.url.startsWith(self.location.origin)) return;

  // Google Fonts / external CDN: network-first
  if (request.url.includes('fonts.googleapis.com') || request.url.includes('fonts.gstatic.com')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(request)
      .then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          // Cache successful same-origin responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        });
      })
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        if (clients.length > 0) {
          return clients[0].focus();
        }
        return self.clients.openWindow('./');
      })
  );
});
