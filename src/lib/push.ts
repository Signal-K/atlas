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
