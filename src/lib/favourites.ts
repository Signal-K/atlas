import { db, type Favourite } from './db'
import { pb } from './pocketbase'

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
  const entries: Favourite[] = kinds.map((kind) => ({
    id: crypto.randomUUID(),
    userId: user,
    kind: 'event_type',
    value: kind,
  }))
  await db.favourites.bulkPut(entries)

  if (!pb.authStore.isValid || !navigator.onLine) return
  for (const entry of entries) {
    try {
      await pb.collection('atlas_favourites').create({ user: pb.authStore.record?.id, kind: entry.kind, value: entry.value })
    } catch {
      // Likely already exists (unique index) or offline race — local copy stands either way.
    }
  }
}
