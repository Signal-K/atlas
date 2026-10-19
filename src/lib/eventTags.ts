import { db, type SkyEvent } from './db'
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

const DUE_SOON_WINDOW_MS = 48 * 60 * 60_000

// A signed-up (tagged) event becomes actionable in the Hub once it's either
// under way or starting within 48 hours -- surfacing it any earlier just
// clutters the Hub with nothing to actually do yet, and any later misses
// the window entirely (an event that already ended is not "due soon").
export function isEventDueSoon(event: Pick<SkyEvent, 'startsAt' | 'endsAt'>, now = new Date()): boolean {
  const nowMs = now.getTime()
  const startsMs = new Date(event.startsAt).getTime()
  const endsMs = new Date(event.endsAt).getTime()
  const ongoing = startsMs <= nowMs && nowMs <= endsMs
  const upcoming = startsMs > nowMs && startsMs - nowMs <= DUE_SOON_WINDOW_MS
  return ongoing || upcoming
}

// Tagged (signed-up) events that belong on the Hub right now, ordered so an
// already-ongoing event (the more time-pressured case) outranks one that's
// merely starting soon.
export async function getSignedUpEventsDueSoon(now = new Date()): Promise<SkyEvent[]> {
  const taggedIds = await getTaggedEventIds()
  if (taggedIds.size === 0) return []

  const events = await db.skyEvents.where('id').anyOf(Array.from(taggedIds)).toArray()
  const dueSoon = events.filter((event) => isEventDueSoon(event, now))
  return dueSoon.sort((a, b) => {
    const aOngoing = new Date(a.startsAt).getTime() <= now.getTime()
    const bOngoing = new Date(b.startsAt).getTime() <= now.getTime()
    if (aOngoing !== bOngoing) return aOngoing ? -1 : 1
    return a.startsAt.localeCompare(b.startsAt)
  })
}
