import { pb } from './pocketbase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && Boolean(VAPID_PUBLIC_KEY)
}

// iOS Safari never exposes PushManager to a page running in a plain browser
// tab, on any iOS version -- Apple only grants Web Push to a page launched
// from a Home Screen icon (display-mode: standalone), and only from iOS
// 16.4+. isPushSupported() alone can't tell "will never work here" (desktop
// Safari, an unsupported browser) apart from "would work if installed and
// opened from its icon" -- this distinguishes the second case so the UI can
// point someone at the fix instead of a dead-end "not supported."
export function isIOSSafariNotStandalone(): boolean {
  const isIOSDevice = /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent))
  if (!isIOSDevice) return false
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
  return !isStandalone
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null
  const registration = await navigator.serviceWorker.ready
  return registration.pushManager.getSubscription()
}

// Requires sign-in: atlas_push_subscriptions is user-owned (AT-011 schema),
// and there'd be nowhere to route a notification for a subscription no user
// account is attached to.
export async function subscribeToPush(): Promise<void> {
  if (!VAPID_PUBLIC_KEY) throw new Error('Push notifications are not configured on this deployment.')
  if (!pb.authStore.isValid) throw new Error('Sign in to enable push notifications.')

  // Chrome implicitly prompts for Notification permission inside
  // pushManager.subscribe() itself, but Safari (iOS/macOS) does not -- it
  // rejects subscribe() with a NotAllowedError unless permission was
  // already granted via an explicit Notification.requestPermission() call
  // first. This is why "Enable" silently failed for installed Safari PWAs.
  if ('Notification' in window && Notification.permission !== 'granted') {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') throw new Error('Notification permission was not granted.')
  }

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
  })
  const json = subscription.toJSON()

  await pb.collection('atlas_push_subscriptions').create({
    user: pb.authStore.record?.id,
    endpoint: json.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
  })
}

export async function unsubscribeFromPush(): Promise<void> {
  const subscription = await getPushSubscription()
  if (!subscription) return

  const endpoint = subscription.endpoint
  await subscription.unsubscribe()

  if (pb.authStore.isValid) {
    try {
      const record = await pb.collection('atlas_push_subscriptions').getFirstListItem(`endpoint = "${endpoint}"`)
      await pb.collection('atlas_push_subscriptions').delete(record.id)
    } catch {
      // Already gone server-side, or offline — nothing further to clean up.
    }
  }
}
