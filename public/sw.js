/* PWA Service Worker — kein Whoop-Cloud-Sync mehr (BLE-first, ohne Abo). */
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const raw = event.notification?.data?.url
  const path = typeof raw === 'string' && raw.startsWith('/') ? raw : '/fitnessdaten'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(path)
    }),
  )
})
