const CACHE_NAME = 'jux-music-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/jux-icon-192.png',
  '/jux-icon-512.png'
];

// PWA Installation handler
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch handler - Cache first for static assets, Network first for API calls
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API calls and dynamic images with network-first strategy
  if (url.pathname.startsWith('/api') || url.pathname.includes('/files/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses for images
          if (response.ok && url.pathname.includes('/files/')) {
            const cache = caches.open(CACHE_NAME);
            cache.then((c) => c.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Handle navigations
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match(request).then((response) => response || caches.match('/')))
    );
    return;
  }

  // Default: Cache first strategy for static assets
  event.respondWith(
    caches.match(request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });
        return response;
      });
    }).catch(() => {
      // Return a generic offline response
      return new Response('Offline - Resource not available', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: new Headers({ 'Content-Type': 'text/plain' })
      });
    })
  );
});

// Media notification handlers
self.addEventListener('message', (event) => {
  const { type, data } = event.data;

  if (type === 'SHOW_NOTIFICATION') {
    self.registration.showNotification(data.title, data.options);
  } else if (type === 'CLOSE_NOTIFICATION') {
    self.registration.getNotifications({ tag: data.tag }).then((notifications) => {
      notifications.forEach((notif) => notif.close());
    });
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const clients = self.clients;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length === 0) {
        clients.openWindow('/');
        return;
      }

      const client = clientList[0];
      let messageType = '';

      switch (action) {
        case 'play': messageType = 'NOTIFICATION_PLAY'; break;
        case 'pause': messageType = 'NOTIFICATION_PAUSE'; break;
        case 'next': messageType = 'NOTIFICATION_NEXT'; break;
        case 'previous': messageType = 'NOTIFICATION_PREVIOUS'; break;
        default:
          client.focus();
          return;
      }

      if (messageType) client.postMessage({ type: messageType });
      client.focus();
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  // Clean up if needed
});
