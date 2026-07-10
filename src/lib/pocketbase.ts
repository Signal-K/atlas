import PocketBase from 'pocketbase'

export const pocketBaseUrl = import.meta.env.VITE_PB_URL ?? 'http://127.0.0.1:8090'

export const pb = new PocketBase(pocketBaseUrl)

// Auth state is persisted by the SDK's default authStore (localStorage).
// Every collection read/write in this app should go through src/lib/db.ts
// instead of calling `pb` directly, so it works offline.
