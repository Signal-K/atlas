import { pb } from './pocketbase'
import { db, type SkyEvent } from './db'

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
    await db.skyEvents.bulkPut(events)
  } catch {
    // Offline or PocketBase unreachable — the existing local cache stands.
  }
}

export async function getUpcomingEvents(limit = 10): Promise<SkyEvent[]> {
  const now = new Date().toISOString()
  const all = await db.skyEvents.orderBy('startsAt').toArray()
  return all.filter((event) => event.startsAt >= now).slice(0, limit)
}
