/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

const MEDIA_CACHE = 'atlas-portfolio-media-v1'
const dirtyClientIds = new Set<string>()

// Portfolio previews are remote PocketBase/R2 images, so they are not part
// of the app-shell precache. Keep successful image responses in a small
// runtime cache instead: the first visit fetches them normally, while
// revisiting the Journal or opening the PWA offline can paint from disk.
self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || request.destination !== 'image') return

  event.respondWith(
    caches.open(MEDIA_CACHE).then(async (cache) => {
      const cached = await cache.match(request)
      if (cached) return cached
      try {
        const response = await fetch(request)
        if (response.ok || response.type === 'opaque') await cache.put(request, response.clone())
        return response
      } catch {
        return cached ?? Response.error()
      }
    }),
  )
})

self.addEventListener('message', (event) => {
  const payload = event.data as { type?: string; dirty?: boolean } | null
  if (payload?.type !== 'atlas:dirty-forms') return
  const source = event.source
  if (!source || !('id' in source)) return
  const clientId = source.id
  if (payload.dirty) dirtyClientIds.add(clientId)
  else dirtyClientIds.delete(clientId)
})

// Take over immediately on every deploy instead of waiting for all tabs of
// the old version to close (see vite.config.ts for why this matters).
self.skipWaiting()
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim()
      // An already-open Atlas tab keeps executing the old JavaScript even
      // after this worker takes over. Navigate controlled windows once so
      // entitlement fixes and new feature access become active immediately
      // instead of requiring the user to discover that a reload is needed.
      //
      // A *focused* window is skipped: client.navigate() is a hard reload
      // with no prompt, and a deploy can land while someone is mid-journal-
      // entry or filling in a form -- silently wiping that is worse than
      // running slightly-stale JS until they next background this tab,
      // switch tabs, or reload it themselves.
      const windows = await self.clients.matchAll({ type: 'window' })
      const activeClientIds = new Set(windows.map((client) => client.id))
      for (const clientId of [...dirtyClientIds]) {
        if (!activeClientIds.has(clientId)) dirtyClientIds.delete(clientId)
      }
      await Promise.all(
        windows.map((client) => {
          if (dirtyClientIds.has(client.id)) {
            client.postMessage({ type: 'atlas-update-available' })
            return Promise.resolve()
          }
          if (!('navigate' in client) || client.focused) return Promise.resolve()
          return client.navigate(client.url)
        }),
      )
    })(),
  )
})

// AT-011: the scheduled notify workflow (scripts/notify.mjs) sends a JSON
// payload of { title, body, url }.
self.addEventListener('push', (event) => {
  let payload: { title?: string; body?: string; url?: string } = {}
  try {
    payload = event.data?.json() ?? {}
  } catch {
    payload = { body: event.data?.text() }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'Atlas', {
      body: payload.body ?? 'A good viewing opportunity is coming up.',
      icon: '/pwa-192.png',
      data: { url: payload.url ?? '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? '/'
  event.waitUntil(self.clients.openWindow(url))
})
