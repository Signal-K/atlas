import { db, type Favourite } from './db'
import { pb } from './pocketbase'
import { enqueueSync } from './syncQueue'

const LOCAL_USER_ID = 'local'

function scopeId(): string {
  return pb.authStore.record?.id ?? LOCAL_USER_ID
}

export async function getFavouriteEventTypes(): Promise<string[]> {
  const all = await db.favourites.where('userId').equals(scopeId()).and((f) => f.kind === 'event_type').toArray()
  return all.map((f) => f.value)
}

// Local-first: saves to Dexie immediately, then best-effort pushes to
// PocketBase when signed in and online (same pattern as observations).
export async function saveEventTypeFavourites(kinds: string[]): Promise<void> {
  const user = scopeId()
  const existing = await db.favourites.where('userId').equals(user).and((f) => f.kind === 'event_type').toArray()
  const existingKinds = new Set(existing.map((entry) => entry.value))
  const entries: Favourite[] = kinds
    .filter((kind) => !existingKinds.has(kind))
    .map((kind) => ({ id: crypto.randomUUID(), userId: user, kind: 'event_type', value: kind }))
  if (entries.length === 0) return
  await db.favourites.bulkPut(entries)

  if (!pb.authStore.isValid) return // guest scope -- accountMerge.ts pushes these on sign-up
  for (const entry of entries) {
    const payload = { user: pb.authStore.record?.id, kind: entry.kind, value: entry.value }
    if (!navigator.onLine) {
      await enqueueSync('atlas_favourites', 'create', entry.id, payload)
      continue
    }
    try {
      await pb.collection('atlas_favourites').create(payload)
    } catch {
      // Likely already exists (unique index), or a transient failure --
      // queue it either way; flushSyncQueue() treats "already exists" as
      // success and clears it on the next pass.
      await enqueueSync('atlas_favourites', 'create', entry.id, payload)
    }
  }
}
