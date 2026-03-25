// Workbox manifest placeholder
self.__WB_MANIFEST;

// PWA Installation handler
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(self.clients.claim());
});

// Fetch handler — required for PWA installability
self.addEventListener('fetch', (event) => {
  // Network-first strategy: try network, fall back to cache
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
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
        case 'like': messageType = 'NOTIFICATION_LIKE'; break;
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
