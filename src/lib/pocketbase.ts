import PocketBase from 'pocketbase'
import { isDemoMode } from './demoMode'

export const pocketBaseUrl = import.meta.env.VITE_PB_URL ?? 'http://127.0.0.1:8090'

export const pb = new PocketBase(pocketBaseUrl)

// Auth state is persisted by the SDK's default authStore (localStorage).
// Every collection read/write in this app should go through src/lib/db.ts
// instead of calling `pb` directly, so it works offline.

// Local demo mode (see demoMode.ts): fail every request before it reaches
// the network, so every `pb.collection(...)` call site -- most of which
// already have an offline/error fallback for when PocketBase is genuinely
// unreachable -- takes that same fallback path without a Docker backend
// running. `send()` awaits `beforeSend` directly, so throwing here rejects
// the calling PocketBase method the same way a network failure would.
pb.beforeSend = (url, options) => {
  if (isDemoMode()) throw new Error('Atlas demo mode: PocketBase calls are disabled locally.')
  return { url, options }
}
