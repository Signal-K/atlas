import { pb } from './pocketbase'
import { db, type ObservationLogEntry, type SkyEvent } from './db'

const MELBOURNE = { lat: -37.8136, lon: 144.9631 }

function eventAtLocalHour(now: Date, hour: number): Date {
  const date = new Date(now)
  date.setHours(hour, 0, 0, 0)
  if (date.getTime() < now.getTime()) date.setDate(date.getDate() + 1)
  return date
}

function localNightSkyFallbackEvents(now = new Date()): SkyEvent[] {
  const updatedAt = now.toISOString()
  const evening = eventAtLocalHour(now, 19)
  const morning = eventAtLocalHour(now, 5)
  const items = [
    {
      id: 'local-melbourne-jupiter',
      target: 'melbourne_jupiter',
      title: 'Jupiter from Melbourne tonight',
      description: 'Check Jupiter low in twilight when it is above the western horizon; clear horizon lines matter.',
      startsAt: evening,
    },
    {
      id: 'local-melbourne-venus',
      target: 'melbourne_venus',
      title: 'Venus from Melbourne tonight',
      description: 'Look for Venus in evening twilight when it is separated enough from the Sun.',
      startsAt: evening,
    },
    {
      id: 'local-melbourne-saturn',
      target: 'melbourne_saturn',
      title: 'Saturn from Melbourne late tonight',
      description: 'Saturn is a late-night telescope target; steady seeing gives the best view of its thin ring presentation.',
      startsAt: morning,
    },
    {
      id: 'local-melbourne-scorpius',
      target: 'melbourne_scorpius',
      title: 'Scorpius and the Milky Way core',
      description: 'Scorpius anchors the southern winter sky and is a strong naked-eye and wide-field target from Melbourne.',
      startsAt: evening,
    },
  ]

  return items.map((item) => ({
    id: `${item.id}-${item.startsAt.toISOString().slice(0, 10)}`,
    kind: 'local_night_sky',
    target: item.target,
    title: item.title,
    description: item.description,
    content: item.description,
    startsAt: item.startsAt.toISOString(),
    endsAt: new Date(item.startsAt.getTime() + 2 * 3_600_000).toISOString(),
    latitude: MELBOURNE.lat,
    longitude: MELBOURNE.lon,
    updatedAt,
  }))
}

// Read path (AT-003): pull sky_events into the local cache when online.
// Every read in the app goes through Dexie, not this function directly, so
// the dashboard still renders from cache when offline or when this fails.
//
// Today/Events/Plan each call this on their own mount, so more than one can
// be in flight at once (e.g. all three tabs mounted at once, or a fast tab
// switch before the previous call resolved). Two overlapping calls each run
// their own bulkDelete-stale-then-bulkPut transaction against the same
// Dexie table; if they interleave, the later delete can be computed against
// a snapshot that predates the earlier call's insert, wiping out events it
// just wrote and leaving only stragglers (e.g. the always-re-added local
// fallback events) behind. Sharing one in-flight promise across callers
// avoids that race entirely.
let inFlightPull: Promise<void> | null = null

export function pullSkyEvents(windowDays = 270): Promise<void> {
  if (inFlightPull) return inFlightPull
  inFlightPull = pullSkyEventsNow(windowDays).finally(() => {
    inFlightPull = null
  })
  return inFlightPull
}

async function pullSkyEventsNow(windowDays: number): Promise<void> {
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
      // PocketBase's `latitude`/`longitude` are non-required number fields,
      // but a non-required *number* field still defaults to 0 (not null)
      // when a plugin doesn't set it for a genuinely global event (moon
      // phase, meteor showers, aurora, ...). (0, 0) isn't a real seeded
      // city, so treat that pair as "no location" rather than literally
      // the Gulf of Guinea -- otherwise every global event would get
      // wrongly treated as location-specific when filtering "tonight near
      // me" (see getTonightPlan in tonightTargets.ts).
      latitude: record.latitude === 0 && record.longitude === 0 ? undefined : record.latitude,
      longitude: record.latitude === 0 && record.longitude === 0 ? undefined : record.longitude,
      updatedAt: record.updated,
    }))
    const mergedEvents = [...events, ...localNightSkyFallbackEvents(now)]
    const freshIds = new Set(mergedEvents.map((event) => event.id))
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
      await db.skyEvents.bulkPut(mergedEvents)
    })
  } catch {
    await db.skyEvents.bulkPut(localNightSkyFallbackEvents(now))
  }
}

export async function getUpcomingEvents(limit = 10): Promise<SkyEvent[]> {
  const now = new Date().toISOString()
  const all = await db.skyEvents.orderBy('startsAt').toArray()
  return all.filter((event) => event.startsAt >= now).slice(0, limit)
}

export async function getEventsInRange(start: Date, end: Date): Promise<SkyEvent[]> {
  const all = await db.skyEvents.orderBy('startsAt').toArray()
  return all.filter((event) => event.startsAt >= start.toISOString() && event.startsAt < end.toISOString())
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
    // The SDK auto-converts to multipart/form-data when a value is a
    // File/Blob, so `photo` can be passed straight through when present.
    await pb.collection('atlas_observations').create({
      user: pb.authStore.record?.id,
      observed_at: entry.observedAt,
      event: entry.eventId,
      note: entry.note,
      target_name: entry.targetName,
      device_used: entry.deviceUsed,
      camera_recipe_used: entry.cameraRecipeUsed,
      location_label: entry.locationLabel,
      condition_summary: entry.conditionSummary,
      attempt_rating: entry.attemptRating,
      ...(entry.photo ? { photo: entry.photo } : {}),
    })
  } catch {
    // Stays local-only; the user still sees it in their Scrapbook.
  }
}
