import { pb } from './pocketbase'
import { db, type ObservationLogEntry, type SkyEvent } from './db'
import { parsePbDate } from './pocketbaseDate'
import { categoryForKind } from './eventCategories'

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
let inFlightObservationPull: Promise<void> | null = null

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
      // parsePbDate, not new Date() directly -- record.starts_at/ends_at
      // are PocketBase's raw space-separated format, which real Safari
      // (unlike the Chrome/Node this was tested in) parses as Invalid
      // Date, throwing on .toISOString() below and taking down this
      // entire records.map() -- see the catch below, which was silently
      // replacing every real event with just the 4 hardcoded local
      // fallback targets whenever that happened.
      startsAt: parsePbDate(record.starts_at).toISOString(),
      endsAt: parsePbDate(record.ends_at).toISOString(),
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

// Observations are local-first, but unlike sky events they are private to an
// account and therefore cannot be seeded into a new browser's IndexedDB. The
// original write path only ever pushed records; it never hydrated them again.
// That meant a desktop browser with an empty cache truthfully had no local
// entries even when the signed-in account had years of records in PocketBase.
//
// Keep this as a bounded, authenticated pull. We deliberately do not delete
// local-only records that the server does not return: an interrupted/offline
// write must remain recoverable in the browser that created it.
export function pullObservations(): Promise<void> {
  if (inFlightObservationPull) return inFlightObservationPull
  inFlightObservationPull = pullObservationsNow().finally(() => {
    inFlightObservationPull = null
  })
  return inFlightObservationPull
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function attemptRating(value: unknown): ObservationLogEntry['attemptRating'] {
  return value === 'poor' || value === 'ok' || value === 'good' || value === 'great' ? value : undefined
}

async function pullObservationPhoto(record: Parameters<typeof pb.files.getURL>[0]): Promise<Blob | undefined> {
  const filename = optionalText((record as { photo?: unknown }).photo)
  if (!filename) return undefined

  try {
    const response = await fetch(pb.files.getURL(record, filename), {
      headers: { Authorization: pb.authStore.token },
      signal: AbortSignal.timeout(20_000),
    })
    return response.ok ? await response.blob() : undefined
  } catch {
    // Metadata still belongs in the journal even if a large file is slow or
    // temporarily unavailable. A later Journal visit retries this pull.
    return undefined
  }
}

async function pullObservationsNow(): Promise<void> {
  if (!pb.authStore.isValid || !navigator.onLine) return

  try {
    const userId = pb.authStore.record?.id as string | undefined
    if (!userId) return

    const records = await pb.collection('atlas_observations').getFullList({
      sort: '-observed_at',
      signal: AbortSignal.timeout(20_000),
    })
    const existing = await db.observations.where('userId').equals(userId).toArray()
    const existingByRemoteId = new Map(existing.flatMap((entry) => (entry.remoteId ? [[entry.remoteId, entry] as const] : [])))

    for (const record of records) {
      const local = existingByRemoteId.get(record.id)
      const downloadedPhoto = local?.photo ? undefined : await pullObservationPhoto(record)
      const fields: Omit<ObservationLogEntry, 'id' | 'userId'> = {
        observedAt: parsePbDate(record.observed_at).toISOString(),
        remoteId: record.id,
        ...(optionalText(record.event) ? { eventId: record.event } : {}),
        ...(optionalText(record.note) ? { note: record.note } : {}),
        ...(optionalText(record.target_name) ? { targetName: record.target_name } : {}),
        ...(optionalText(record.device_used) ? { deviceUsed: record.device_used } : {}),
        ...(optionalText(record.camera_recipe_used) ? { cameraRecipeUsed: record.camera_recipe_used } : {}),
        ...(optionalText(record.location_label) ? { locationLabel: record.location_label } : {}),
        ...(optionalText(record.condition_summary) ? { conditionSummary: record.condition_summary } : {}),
        ...(attemptRating(record.attempt_rating) ? { attemptRating: attemptRating(record.attempt_rating) } : {}),
        ...(optionalText(record.ai_caption) ? { aiCaption: record.ai_caption } : {}),
        ...(record.public === true ? { isPublic: true } : {}),
        ...(downloadedPhoto ? { photo: downloadedPhoto } : local?.photo ? { photo: local.photo } : {}),
      }

      if (local) {
        await db.observations.update(local.id, fields)
      } else {
        await db.observations.add({ id: `remote-${record.id}`, userId, ...fields })
      }
    }
  } catch {
    // The Journal continues to show its local cache offline or when the
    // private collection is temporarily unavailable.
  }
}

// For a past prominent event, find upcoming events a user would recognize
// as "the same kind of thing" (KES-178) -- grouped by EVENT_CATEGORIES
// bucket rather than exact `kind`, so e.g. a past eclipse also surfaces
// upcoming moon-phase events, not just other eclipses.
export async function getSimilarUpcomingEvents(kind: string, limit = 3): Promise<SkyEvent[]> {
  const category = categoryForKind(kind)
  if (!category) return []
  const now = new Date().toISOString()
  const all = await db.skyEvents.orderBy('startsAt').toArray()
  return all.filter((event) => event.endsAt >= now && category.kinds.includes(event.kind)).slice(0, limit)
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
// Exported so ArchiveView's recap section (KES-178) uses the same
// definition of "prominent" rather than redefining it.
export const FLAGSHIP_KINDS = new Set(['eclipse', 'meteor_shower'])

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
