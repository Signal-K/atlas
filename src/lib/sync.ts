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
  // Overlap, not "starts_at >= now" -- a multi-day event (a meteor shower's
  // widened window, a padded eclipse) that's already in progress has a
  // starts_at in the past even while it's still genuinely happening. The
  // strict lower bound silently excluded it from ever being pulled into the
  // local cache at all, for the entire remainder of the event -- the same
  // overlap-vs-strict-start bug already fixed for the local Dexie queries
  // in getUpcomingEvents/getEventsInRange below, but one layer upstream, in
  // the actual PocketBase fetch filter.
  //
  // PocketBase stores/compares datetimes as "YYYY-MM-DD HH:MM:SS.sssZ" (space
  // separator), not ISO 8601's "T" separator, and its filter engine compares
  // the two strings directly rather than parsing them as dates first. "T"
  // (0x54) sorts after a space (0x20), so any comparison where the event and
  // "now"/"end" fall on the *same calendar date* silently inverts (e.g.
  // "2026-08-12T13:05" is judged *greater* than "2026-08-12 19:15"). That's
  // exactly the case for something happening today -- toISOString() must be
  // converted to PocketBase's own format or same-day comparisons come out
  // backwards.
  const toPbDate = (date: Date) => date.toISOString().replace('T', ' ')
  const filter = `starts_at <= "${toPbDate(end)}" && ends_at >= "${toPbDate(now)}"`

  try {
    // Bounded so an unreachable/slow PocketBase can't hang this call (and
    // whatever awaits it, e.g. Today's initial load) for minutes -- the
    // catch below already falls back to cached/local data, but only once
    // this actually rejects instead of sitting pending indefinitely.
    const records = await pb.collection('sky_events').getFullList({ filter, sort: 'starts_at', signal: AbortSignal.timeout(8000) })
    const events: SkyEvent[] = records.map((record) => ({
      id: record.id,
      kind: record.kind,
      target: record.target,
      title: record.title,
      description: record.description,
      content: record.content,
      imageUrl: record.image_url,
      imageCredit: record.image_credit,
      // Canonicalize to ISO ("T" separator) here, once, rather than storing
      // PocketBase's raw "YYYY-MM-DD HH:MM:SS.sssZ" strings verbatim. Every
      // downstream comparison (getUpcomingEvents/getEventsInRange/getPastEvents
      // below, and the "HAPPENING NOW" check in EventsView/HubView) compares
      // these against `new Date().toISOString()`, which is "T"-separated --
      // mixing the two formats hits the same space-vs-"T" ASCII ordering bug
      // as the PocketBase filter above, but here it silently breaks every
      // "is this still happening" check for the rest of the app.
      startsAt: new Date(record.starts_at).toISOString(),
      endsAt: new Date(record.ends_at).toISOString(),
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
  // "Upcoming" means not yet over, not "not yet started" -- a multi-hour
  // event like a meteor shower (evening-to-dawn window) or an eclipse has a
  // startsAt in the past for most of the time it's actually happening
  // (e.g. Perseids: startsAt is the evening before peak). Filtering on
  // startsAt alone made an event you should see *tonight* vanish from every
  // "upcoming" list the moment its window opened, well before it ended.
  return all.filter((event) => event.endsAt >= now).slice(0, limit)
}

export async function getEventsInRange(start: Date, end: Date): Promise<SkyEvent[]> {
  const all = await db.skyEvents.orderBy('startsAt').toArray()
  // Overlap, not strict containment -- an event that started before `start`
  // but hasn't ended yet (e.g. a shower already in progress at the top of
  // the range) should still count as "in range", same reasoning as above.
  return all.filter((event) => event.startsAt < end.toISOString() && event.endsAt >= start.toISOString())
}

// Same "flagship" definition EventsView uses for the featured cards above
// the fold -- eclipses and meteor showers are rare enough to be worth
// surfacing, unlike the high-frequency filler kinds (local night-sky
// guides, asteroid passes) that otherwise dominate purely by recency.
const FLAGSHIP_KINDS = new Set(['eclipse', 'meteor_shower'])

export async function getPastEvents(limit = 20): Promise<SkyEvent[]> {
  const now = new Date().toISOString()
  const all = await db.skyEvents.orderBy('startsAt').reverse().toArray()
  const past = all.filter((event) => event.endsAt < now)
  // Guarantee flagship events a slot instead of letting them get crowded out
  // of a plain "most recent N" slice by same-day/more-recent filler -- then
  // backfill the rest and re-sort, since ArchiveView's groupByDay depends on
  // the array staying date-descending for its adjacency-based grouping.
  const flagship = past.filter((event) => FLAGSHIP_KINDS.has(event.kind)).slice(0, limit)
  const other = past.filter((event) => !FLAGSHIP_KINDS.has(event.kind)).slice(0, limit - flagship.length)
  return [...flagship, ...other].sort((a, b) => b.startsAt.localeCompare(a.startsAt))
}

// Write path: best-effort immediate push when signed in and online. The
// entry is already saved locally by the caller before this runs, so a
// failure here just means it stays local-only rather than being lost —
// a full offline write queue (retrying failed pushes later) is future work.
// Returns the created PocketBase record id (also persisted onto the local
// entry as `remoteId`) so callers that need the remote id right after
// saving -- e.g. requesting an AI photo caption, which stores its result
// back onto that same record -- don't have to duplicate this create call
// the way shareObservation() previously did.
export async function pushObservation(entry: ObservationLogEntry): Promise<string | null> {
  if (!pb.authStore.isValid || !navigator.onLine) return null

  try {
    // The SDK auto-converts to multipart/form-data when a value is a
    // File/Blob, so `photo` can be passed straight through when present.
    const record = await pb.collection('atlas_observations').create({
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
    await db.observations.update(entry.id, { remoteId: record.id })
    return record.id
  } catch {
    // Stays local-only; the user still sees it in their Scrapbook.
    return null
  }
}
