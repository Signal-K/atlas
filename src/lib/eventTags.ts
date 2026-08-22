import { db } from './db'
import { pb } from './pocketbase'
import { enqueueSync } from './syncQueue'

const LOCAL_USER_ID = 'local'

function scopeId(): string {
  return pb.authStore.record?.id ?? LOCAL_USER_ID
}

// Per-event bookmark ("tag this specific event"), distinct from
// watchlist.ts's kind/target-level "watch" -- see the TaggedEvent comment
// in db.ts. Local-first, same online/offline sync shape as watchlist.ts.

export async function getTaggedEventIds(): Promise<Set<string>> {
  const user = scopeId()
  const entries = await db.taggedEvents.where('userId').equals(user).toArray()
  return new Set(entries.map((entry) => entry.eventId))
}

export function isTagged(taggedIds: Set<string>, eventId: string): boolean {
  return taggedIds.has(eventId)
}

export async function tagEvent(eventId: string): Promise<void> {
  const user = scopeId()
  const existing = await db.taggedEvents
    .where('userId')
    .equals(user)
    .and((entry) => entry.eventId === eventId)
    .first()
  if (existing) return

  const entry = { id: crypto.randomUUID(), userId: user, eventId, taggedAt: new Date().toISOString() }
  await db.taggedEvents.put(entry)
  if (pb.authStore.isValid) {
    const payload = { user: pb.authStore.record?.id, event_id: eventId, tagged_at: entry.taggedAt }
    if (!navigator.onLine) {
      await enqueueSync('atlas_tagged_events', 'create', entry.id, payload)
    } else {
      try {
        await pb.collection('atlas_tagged_events').create(payload)
      } catch {
        await enqueueSync('atlas_tagged_events', 'create', entry.id, payload)
      }
    }
  }
  window.dispatchEvent(new Event('atlas:tagged-events-changed'))
}

// Remote deletion is skipped, same limitation as watchlist.ts's
// removeFromWatchlist: the local mirror doesn't track the PocketBase record
// id for a tagged event, so removing while online only clears the local
// cache. It's re-created locally next pull if it still exists server-side.
export async function untagEvent(eventId: string): Promise<void> {
  const user = scopeId()
  const existing = await db.taggedEvents
    .where('userId')
    .equals(user)
    .and((entry) => entry.eventId === eventId)
    .first()
  if (!existing) return
  await db.taggedEvents.delete(existing.id)
  window.dispatchEvent(new Event('atlas:tagged-events-changed'))
}

export async function toggleEventTag(eventId: string, currentlyTagged: boolean): Promise<void> {
  if (currentlyTagged) {
    await untagEvent(eventId)
  } else {
    await tagEvent(eventId)
  }
}
