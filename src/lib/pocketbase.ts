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

// Fly's PocketBase machines run with min_machines_running=0 and stop when
// idle -- a cold start takes ~10-15s (see Landnam/web/lib/contexts/
// useAuthSync.ts, which measured the same backend topology). Firing a
// cheap health check as soon as this module loads means the machine is
// already waking by the time real auth/sync requests go out, instead of
// the user's first genuine action eating the full cold-start latency.
// Best-effort: offline/demo mode/backend-down all fail silently here,
// same as every other best-effort PocketBase call in this app.
if (!isDemoMode()) {
  pb.health.check().catch(() => {})
}
