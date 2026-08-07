/* PWA + WHOOP-Hintergrund-Cloud-Sync (kein BLE im SW — Browser-Limit). */
const WHOOP_SYNC_TAG = 'whoop-cloud-sync'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})

async function whoopCloudSyncAusSw() {
  try {
    const res = await fetch('/api/fitnessdaten/whoop/sync', {
      method: 'POST',
      credentials: 'include',
    })
    if (!res.ok) return false
    const data = await res.json()
    return Boolean(data?.ok)
  } catch {
    return false
  }
}

async function benachrichtigeClients() {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  for (const client of clients) {
    client.postMessage({ type: 'whoop-background-sync', ok: true })
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag !== WHOOP_SYNC_TAG) return
  event.waitUntil(
    whoopCloudSyncAusSw().then((ok) => {
      if (ok) return benachrichtigeClients()
    }),
  )
})

self.addEventListener('periodicsync', (event) => {
  if (event.tag !== WHOOP_SYNC_TAG) return
  event.waitUntil(
    whoopCloudSyncAusSw().then((ok) => {
      if (ok) return benachrichtigeClients()
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const raw = event.notification?.data?.url
  const path = typeof raw === 'string' && raw.startsWith('/') ? raw : '/fuehrung'
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

