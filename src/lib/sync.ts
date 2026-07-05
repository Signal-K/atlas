import { pb } from './pocketbase'
import { db, type ObservationLogEntry, type SkyEvent } from './db'

// Read path (AT-003): pull sky_events into the local cache when online.
// Every read in the app goes through Dexie, not this function directly, so
// the dashboard still renders from cache when offline or when this fails.
export async function pullSkyEvents(windowDays = 270): Promise<void> {
  if (!navigator.onLine) return

  const now = new Date()
  const end = new Date(now.getTime() + windowDays * 86400_000)
  const filter = `starts_at >= "${now.toISOString()}" && starts_at <= "${end.toISOString()}"`

  try {
    const records = await pb.collection('sky_events').getFullList({ filter, sort: 'starts_at' })
    const events: SkyEvent[] = records.map((record) => ({
      id: record.id,
      kind: record.kind,
      target: record.target,
      title: record.title,
      description: record.description,
      content: record.content,
      imageUrl: record.image_url,
      imageCredit: record.image_credit,
      startsAt: record.starts_at,
      endsAt: record.ends_at,
      latitude: record.latitude,
      longitude: record.longitude,
      updatedAt: record.updated,
    }))
    const freshIds = new Set(events.map((event) => event.id))
    // Reconcile, not just merge: drop cached events inside this window that
    // the server no longer returns (e.g. removed server-side duplicates),
    // otherwise stale entries accumulate in IndexedDB forever since bulkPut
    // only ever adds/updates, never removes.
    const staleIds = await db.skyEvents
      .where('startsAt')
      .between(now.toISOString(), end.toISOString())
      .filter((event) => !freshIds.has(event.id))
      .primaryKeys()

    await db.transaction('rw', db.skyEvents, async () => {
      if (staleIds.length > 0) await db.skyEvents.bulkDelete(staleIds)
      await db.skyEvents.bulkPut(events)
    })
  } catch {
    // Offline or PocketBase unreachable — the existing local cache stands.
  }
}

export async function getUpcomingEvents(limit = 10): Promise<SkyEvent[]> {
  const now = new Date().toISOString()
  const all = await db.skyEvents.orderBy('startsAt').toArray()
  return all.filter((event) => event.startsAt >= now).slice(0, limit)
}

export async function getPastEvents(limit = 20): Promise<SkyEvent[]> {
  const now = new Date().toISOString()
  const all = await db.skyEvents.orderBy('startsAt').reverse().toArray()
  return all.filter((event) => event.startsAt < now).slice(0, limit)
}

// Write path: best-effort immediate push when signed in and online. The
// entry is already saved locally by the caller before this runs, so a
// failure here just means it stays local-only rather than being lost —
// a full offline write queue (retrying failed pushes later) is future work.
export async function pushObservation(entry: ObservationLogEntry): Promise<void> {
  if (!pb.authStore.isValid || !navigator.onLine) return

  try {
    await pb.collection('atlas_observations').create({
      user: pb.authStore.record?.id,
      observed_at: entry.observedAt,
      event: entry.eventId,
      note: entry.note,
    })
  } catch {
    // Stays local-only; the user still sees it in their Scrapbook.
  }
}
