/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Take over immediately on every deploy instead of waiting for all tabs of
// the old version to close (see vite.config.ts for why this matters).
self.skipWaiting()
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
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
      icon: '/favicon.svg',
      data: { url: payload.url ?? '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? '/'
  event.waitUntil(self.clients.openWindow(url))
})
