import { db, type Favourite, type SkyEvent, type WatchlistEntry } from './db'
import { pb } from './pocketbase'
import { enqueueSync } from './syncQueue'

const LOCAL_USER_ID = 'local'

function scopeId(): string {
  return pb.authStore.record?.id ?? LOCAL_USER_ID
}

export interface WatchlistItem {
  kind: Favourite['kind']
  value: string
}

export function formatWatchValue(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export async function getWatchlist(): Promise<WatchlistItem[]> {
  const user = scopeId()
  const entries = await db.watchlist.where('userId').equals(user).toArray()
  const favourites = await db.favourites.bulkGet(entries.map((entry) => entry.favouriteId))
  return favourites
    .filter((favourite): favourite is Favourite => favourite != null)
    .map((favourite) => ({ kind: favourite.kind, value: favourite.value }))
}

export function isWatching(watchlist: WatchlistItem[], kind: Favourite['kind'], value: string): boolean {
  return watchlist.some((item) => item.kind === kind && item.value === value)
}

// AT-032: a public, anonymized "N people are watching this" counter,
// bumped client-side since atlas_watchlist itself is user-owned (row-level
// rule restricts reads to the owner) and there's no server-side hook to
// compute an aggregate from it. Best-effort like the rest of Atlas's sync —
// works for signed-out/local users too, since the counter collection has no
// auth requirement.
async function bumpWatchCount(kind: Favourite['kind'], value: string, delta: number): Promise<void> {
  if (!navigator.onLine) return
  try {
    const existing = await pb
      .collection('atlas_watch_counts')
      .getFirstListItem(`kind = "${kind}" && value = "${value}"`)
      .catch(() => null)
    if (existing) {
      const next = Math.max(0, (existing.count ?? 0) + delta)
      await pb.collection('atlas_watch_counts').update(existing.id, { count: next })
    } else if (delta > 0) {
      await pb.collection('atlas_watch_counts').create({ kind, value, count: delta })
    }
  } catch {
    // Best-effort vanity metric — fine to skip on failure.
  }
}

export async function getWatchCounts(): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  try {
    const records = await pb.collection('atlas_watch_counts').getFullList()
    for (const record of records) counts.set(`${record.kind}|${record.value}`, record.count ?? 0)
  } catch {
    // Offline or unreachable — callers treat a missing entry as "no count to show".
  }
  return counts
}

// Combines event-type and target counts, since either (or both) can apply to
// a given event -- an approximation, not a strict per-person tally.
export function getWatchCountForEvent(event: SkyEvent, counts: Map<string, number>): number {
  const kindCount = counts.get(`event_type|${event.kind}`) ?? 0
  const targetCount = counts.get(`target|${event.target}`) ?? 0
  return kindCount + targetCount
}

// Watching something and favouriting it are the same underlying record here
// (a favourite, wrapped in a watchlist entry) — this mirrors the
// favourites-then-watchlist relation PocketBase enforces (AT-002).
export async function addToWatchlist(kind: Favourite['kind'], value: string): Promise<void> {
  const user = scopeId()
  let favourite = await db.favourites
    .where('userId')
    .equals(user)
    .and((f) => f.kind === kind && f.value === value)
    .first()

  if (!favourite) {
    favourite = { id: crypto.randomUUID(), userId: user, kind, value }
    await db.favourites.put(favourite)
    if (pb.authStore.isValid) {
      const payload = { user: pb.authStore.record?.id, kind, value }
      if (!navigator.onLine) {
        await enqueueSync('atlas_favourites', 'create', favourite.id, payload)
      } else {
        try {
          await pb.collection('atlas_favourites').create(payload)
        } catch {
          await enqueueSync('atlas_favourites', 'create', favourite.id, payload)
        }
      }
    }
  }

  const existingEntry = await db.watchlist
    .where('userId')
    .equals(user)
    .and((w) => w.favouriteId === favourite!.id)
    .first()
  if (existingEntry) return

  const entry: WatchlistEntry = { id: crypto.randomUUID(), userId: user, favouriteId: favourite.id, notifyOnGoodViewing: true }
  await db.watchlist.put(entry)
  if (pb.authStore.isValid) {
    const payload = { user: pb.authStore.record?.id, favourite: favourite.id, notify_on_good_viewing: true }
    if (!navigator.onLine) {
      await enqueueSync('atlas_watchlist', 'create', entry.id, payload)
    } else {
      try {
        await pb.collection('atlas_watchlist').create(payload)
      } catch {
        await enqueueSync('atlas_watchlist', 'create', entry.id, payload)
      }
    }
  }
  await bumpWatchCount(kind, value, 1)
}

// Remote deletion is skipped here: the local mirror doesn't track PocketBase
// record ids for watchlist/favourite rows (same limitation as favourites'
// create-only sync), so removing while online only clears the local cache.
// It's re-created locally next pull if it still exists server-side.
export async function removeFromWatchlist(kind: Favourite['kind'], value: string): Promise<void> {
  const user = scopeId()
  const favourite = await db.favourites
    .where('userId')
    .equals(user)
    .and((f) => f.kind === kind && f.value === value)
    .first()
  if (!favourite) return

  const entry = await db.watchlist
    .where('userId')
    .equals(user)
    .and((w) => w.favouriteId === favourite.id)
    .first()
  if (!entry) return

  await db.watchlist.delete(entry.id)
  await bumpWatchCount(kind, value, -1)
}

export function matchesWatchlist(event: SkyEvent, watchlist: WatchlistItem[]): boolean {
  return watchlist.some(
    (item) =>
      (item.kind === 'event_type' && item.value === event.kind) ||
      (item.kind === 'target' && item.value.toLowerCase() === event.target.toLowerCase()),
  )
}

// Distinct, user-facing targets seen in the cache, for the "watch a target"
// picker. ISS pass targets are per-city technical ids (iss_london, ...) and
// not meaningful to watch individually, so they're excluded.
export async function getWatchableTargets(): Promise<string[]> {
  const events = await db.skyEvents.toArray()
  const targets = new Set(events.filter((event) => event.kind !== 'iss_pass').map((event) => event.target))
  return [...targets].sort()
}
