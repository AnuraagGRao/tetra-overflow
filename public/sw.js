// Bump CACHE_NAME to push updates to clients
const CACHE_NAME = 'tetra-overflow-v2'
// Build absolute paths relative to the SW scope so it works under any base URL
const BASE = self.registration.scope
const APP_SHELL = ['', 'index.html', 'manifest.json'].map(p => new URL(p, BASE).href)

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
      .then(async () => {
        const list = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' })
        // Notify all controlled clients that a new SW is active (update available)
        for (const client of list) {
          try { client.postMessage({ type: 'SW_UPDATED', cache: CACHE_NAME }) } catch {}
        }
      }),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached
      return fetch(event.request)
        .then((response) => {
          if (!response.ok || !response.url.startsWith(self.location.origin)) return response
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
          return response
        })
        .catch(() => caches.match('/index.html'))
    }),
  )
})
