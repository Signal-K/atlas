import { ClientResponseError } from 'pocketbase'
import { pb } from './pocketbase'
import { trackEvent } from './analytics'
import { db, type ObservationLogEntry, type SkyEvent } from './db'
import { parsePbDate } from './pocketbaseDate'
import { categoryForKind } from './eventCategories'
import { isGeneratedPastEventId } from './pastEvents.mjs'
import { fetchPrivateObservationPhoto, isAtlasMediaEnabled, isAtlasMediaUploadBlockedError, uploadObservationPhoto } from './atlasMedia'
// Circular by design: checkInReview.ts imports pushObservation from here.
// Both references live inside function bodies, never at module-init scope, so
// the cycle resolves under ESM. See the note at the top of checkInReview.ts.
import { pullReviewSubmissions } from './checkInReview'

function eventAtLocalHour(now: Date, hour: number): Date {
  const date = new Date(now)
  date.setHours(hour, 0, 0, 0)
  if (date.getTime() < now.getTime()) date.setDate(date.getDate() + 1)
  return date
}

// Seed content for the case where the catalogue genuinely has nothing for
// this window -- an empty/unreachable backend should still leave the app
// with something to look at rather than a blank week.
//
// These deliberately carry no latitude/longitude. Events without coordinates
// are treated as globally visible (see eventFilters.ts and tonightTargets.ts),
// which is right for naked-eye planets and a constellation: they are not tied
// to one city the way an ISS pass is. They previously carried Melbourne's
// coordinates and "from Melbourne" in every title, which put the sky over
// Melbourne in front of every user regardless of where they actually were.
function localNightSkyFallbackEvents(now = new Date()): SkyEvent[] {
  const updatedAt = now.toISOString()
  const evening = eventAtLocalHour(now, 19)
  const morning = eventAtLocalHour(now, 5)
  const items = [
    {
      id: 'local-sky-jupiter',
      target: 'jupiter',
      title: 'Jupiter after sunset',
      description: 'Check Jupiter low in twilight when it is above the western horizon; clear horizon lines matter.',
      startsAt: evening,
    },
    {
      id: 'local-sky-venus',
      target: 'venus',
      title: 'Venus in evening twilight',
      description: 'Look for Venus in evening twilight when it is separated enough from the Sun.',
      startsAt: evening,
    },
    {
      id: 'local-sky-saturn',
      target: 'saturn',
      title: 'Saturn before dawn',
      description: 'Saturn is a pre-dawn telescope target; steady seeing gives the best view of its thin ring presentation.',
      startsAt: morning,
    },
    {
      id: 'local-sky-scorpius',
      target: 'scorpius',
      title: 'Scorpius and the Milky Way core',
      description: 'Scorpius sits against the brightest stretch of the Milky Way and is a strong naked-eye and wide-field target from dark skies.',
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

function skyEventFromRecord(record: Record<string, any>): SkyEvent {
  return {
    id: record.id,
    kind: record.kind,
    target: record.target,
    title: record.title,
    description: record.description,
    content: record.content,
    imageUrl: record.image_url,
    imageCredit: record.image_credit,
    // PocketBase returns its date fields with a space separator. Keep that
    // browser-safe format conversion at this boundary, for every event read
    // path (including a Sky Pass backdated check-in).
    startsAt: parsePbDate(record.starts_at).toISOString(),
    endsAt: parsePbDate(record.ends_at).toISOString(),
    latitude: record.latitude === 0 && record.longitude === 0 ? undefined : record.latitude,
    longitude: record.latitude === 0 && record.longitude === 0 ? undefined : record.longitude,
    updatedAt: record.updated,
  }
}

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
    // Fly's PocketBase machine cold-starts in ~10-15s (see lib/pocketbase.ts),
    // so a single 8s attempt reported a failure ("ClientResponseError 0") for
    // every first visitor to a cold machine. One retry with a longer bound
    // covers the wake-up; only a failure after that is worth reporting.
    // requestKey: null stops the SDK auto-cancelling this against another
    // concurrent request to the same collection.
    const fetchEvents = (timeoutMs: number) =>
      pb.collection('sky_events').getFullList({ filter, sort: 'starts_at', requestKey: null, signal: AbortSignal.timeout(timeoutMs) })
    let records
    try {
      records = await fetchEvents(8000)
    } catch (firstErr) {
      if (!(firstErr instanceof ClientResponseError) || firstErr.status !== 0) throw firstErr
      records = await fetchEvents(20000)
    }
    const events = records.map(skyEventFromRecord)
    // Seed content is a fallback, not a supplement. Merging it into every
    // successful pull put four fixed entries into the local cache alongside
    // the real catalogue on every sync, so they competed with genuine events
    // for space in the week table and the Tonight list. Only fall back when
    // the catalogue truly has nothing for this window.
    const mergedEvents = events.length > 0 ? events : localNightSkyFallbackEvents(now)
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
  } catch (err) {
    trackEvent('sync_failed', { stage: 'pull_sky_events', error: String(err) })
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

// The backdated-check-in provenance fields (see checkInReview.ts). Each one is
// a select or text column on the remote side, so the pull path is the only
// place a value from the wire becomes a union type -- narrow here rather than
// trusting the response, for the same reason `attemptRating` above exists.
// `photo_day_ambiguous` is a real bool and needs no narrow, just `=== true`.
function checkInKindValue(value: unknown): ObservationLogEntry['checkInKind'] {
  return value === 'tonight' || value === 'past' ? value : undefined
}

function matchedByValue(value: unknown): ObservationLogEntry['matchedBy'] {
  return value === 'photo-exif' || value === 'photo-exif-heading' || value === 'manual' ? value : undefined
}

function matchConfidenceValue(value: unknown): ObservationLogEntry['matchConfidence'] {
  return value === 'strong' || value === 'possible' || value === 'weak' || value === 'none' ? value : undefined
}

function anchorSourceValue(value: unknown): ObservationLogEntry['anchorSource'] {
  return value === 'trip' ||
    value === 'trip-plan' ||
    value === 'journal-location' ||
    value === 'current-location' ||
    value === 'manual'
    ? value
    : undefined
}

async function pullObservationPhoto(record: Parameters<typeof pb.files.getURL>[0]): Promise<Blob | undefined> {
  const r2Key = optionalText((record as { photo_r2_key?: unknown }).photo_r2_key)
  if (r2Key && isAtlasMediaEnabled()) return fetchPrivateObservationPhoto(r2Key)

  const filename = optionalText((record as { photo?: unknown }).photo)
  if (!filename) return undefined

  try {
    const response = await fetch(pb.files.getURL(record, filename), {
      headers: { Authorization: pb.authStore.token },
      signal: AbortSignal.timeout(20_000),
    })
    // A successful HTTP status alone is not enough: an upstream error page
    // can be returned with 200 and was getting cached as a Blob. Object URLs
    // for those error pages produce the broken-image icon seen in Journal.
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
    if (!response.ok || !contentType.startsWith('image/')) return undefined
    return await response.blob()
  } catch (err) {
    // Metadata still belongs in the journal even if a large file is slow or
    // temporarily unavailable. A later Journal visit retries this pull.
    trackEvent('sync_failed', { stage: 'pull_observation_photo', error: String(err) })
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

    // Hydrate media concurrently. The previous serial loop made a journal
    // visit wait for every full-size attachment in sequence before the
    // portfolio could settle, which was especially painful on a PWA over a
    // mobile connection. Each image is still validated and stored locally;
    // only the network scheduling changes.
    //
    // Each record is isolated via Promise.allSettled: with Promise.all, one
    // record throwing (a Dexie write failure, a malformed field) rejected
    // the whole batch, and the outer catch below swallowed that silently --
    // wiping every *other* record's hydration for this pull too, not just
    // the bad one. That regressed the Journal/city-stamps view from "one
    // entry stayed stale" (the old serial loop's failure mode) to "nothing
    // pulled this visit."
    const results = await Promise.allSettled(records.map(async (record) => {
      const local = existingByRemoteId.get(record.id)
      // A transient media-worker failure must not make a newly-created
      // observation lose its local photo forever. Retry only records that
      // were created for R2 (no legacy PocketBase attachment is present).
      if (isAtlasMediaEnabled() && local?.photo && !optionalText(record.photo_r2_key) && !optionalText(record.photo)) {
        try {
          const uploaded = await uploadObservationPhoto(record.id, local.photo)
          await pb.collection('atlas_observations').update(record.id, { photo_r2_key: uploaded.key, photo_r2_size: uploaded.size })
          record.photo_r2_key = uploaded.key
          record.photo_r2_size = uploaded.size
        } catch (err) {
          // Keep the local image and retry on a later Journal sync.
          trackEvent('sync_failed', { stage: 'r2_photo_reupload_retry', error: String(err) })
        }
      }
      // Re-fetch cached non-images from earlier versions. Do not let a bad
      // response become permanent just because IndexedDB happens to contain
      // a Blob already.
      const cachedPhoto = local?.photo?.type.startsWith('image/') ? local.photo : undefined
      const downloadedPhoto = cachedPhoto ? undefined : await pullObservationPhoto(record)
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
        ...(optionalText(record.photo_r2_key) ? { photoR2Key: record.photo_r2_key } : {}),
        ...(Number.isFinite(Number(record.photo_r2_size)) && Number(record.photo_r2_size) > 0 ? { photoR2Size: Number(record.photo_r2_size) } : {}),
        ...(record.public === true ? { isPublic: true } : {}),
        // Backdated check-in provenance. Absent on every pre-feature row and
        // on a plain tonight check-in, which is exactly what `undefined`
        // means to every reader of these fields.
        //
        // `reviewStatus` / `reviewSubmissionId` are NOT here: the queue
        // collection owns review state, and `pullReviewSubmissions` (called at
        // the end of this function) is what mirrors it onto the entry.
        ...(checkInKindValue(record.check_in_kind) ? { checkInKind: checkInKindValue(record.check_in_kind) } : {}),
        ...(matchedByValue(record.matched_by) ? { matchedBy: matchedByValue(record.matched_by) } : {}),
        ...(matchConfidenceValue(record.match_confidence) ? { matchConfidence: matchConfidenceValue(record.match_confidence) } : {}),
        ...(anchorSourceValue(record.anchor_source) ? { anchorSource: anchorSourceValue(record.anchor_source) } : {}),
        ...(optionalText(record.anchor_label) ? { anchorLabel: record.anchor_label } : {}),
        ...(record.photo_day_ambiguous === true ? { photoDayAmbiguous: true } : {}),
        ...(downloadedPhoto ? { photo: downloadedPhoto } : cachedPhoto ? { photo: cachedPhoto } : {}),
      }

      if (local) {
        await db.observations.update(local.id, fields)
      } else {
        await db.observations.add({ id: `remote-${record.id}`, userId, ...fields })
      }
    }))

    const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    if (failures.length > 0) {
      // Surfaced for debugging (this used to fail silently); the Journal
      // still shows whatever did hydrate successfully above.
      console.error(`pullObservationsNow: ${failures.length}/${records.length} observations failed to hydrate`, failures[0].reason)
    }
  } catch (err) {
    // The Journal continues to show its local cache offline or when the
    // private collection is temporarily unavailable.
    console.error('pullObservationsNow failed', err)
    trackEvent('sync_failed', { stage: 'pull_observations', error: String(err) })
  }

  // Outside the try above, deliberately: review state is independent of
  // whether the observation pull succeeded, and a failure here should not be
  // reported as an observation failure. `pullReviewSubmissions` handles its
  // own errors and never rejects.
  //
  // This is the only call site -- the Journal already awaits
  // `pullObservations()`, so review state refreshes on the same visit with no
  // new hook in any page.
  await pullReviewSubmissions()
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
//
// Defined in pastCheckInMatch.mjs, which is where it now earns its keep: a
// flagship kind earns a `strong` match on time overlap alone, because a photo
// taken inside a three-hour eclipse window does not need its frame parsed to
// know what it is. Re-exported here so the existing consumers do not move.
//
// (`getPastEvents` and `getEventsForDate` used to live here and read
// `db.skyEvents`. Both were removed rather than fixed: that table is a forward
// mirror, `pullSkyEventsNow` actively deletes cached rows it does not get back,
// and it could therefore never answer a question about history. Backdated
// check-ins compute their day instead -- see pastEvents.mjs. Leaving exports
// named `getPastEvents` around is how a future contributor gets wired to a
// table that cannot answer.)
export { FLAGSHIP_KINDS } from './pastCheckInMatch.mjs'

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
    // R2 keeps uploaded image bytes out of the shared PocketBase volume. The
    // older PocketBase file path stays as a graceful fallback until a media
    // Worker URL is configured in the deployed client.
    const useR2 = Boolean(entry.photo && isAtlasMediaEnabled())
    const record = await pb.collection('atlas_observations').create({
      user: pb.authStore.record?.id,
      observed_at: entry.observedAt,
      // Omitted, not nulled, for a backdated check-in: its matched event is a
      // generated `past-…` id that exists nowhere on the server, and PocketBase
      // validates the relation by looking the id up -- so sending it fails the
      // entire record with "Failed to find all relation records with the
      // provided ids" and the night never leaves the device. The title still
      // travels as `target_name`, and a submission that needs review carries
      // the event itself as `event_snapshot`.
      event: isGeneratedPastEventId(entry.eventId) ? undefined : entry.eventId,
      note: entry.note,
      target_name: entry.targetName,
      device_used: entry.deviceUsed,
      camera_recipe_used: entry.cameraRecipeUsed,
      location_label: entry.locationLabel,
      condition_summary: entry.conditionSummary,
      attempt_rating: entry.attemptRating,
      // Backdated check-in provenance. Sent as null when absent, which is what
      // a plain tonight check-in and every pre-feature row have -- so the pull
      // path's narrowers fall through to `undefined` rather than inventing a
      // kind for an entry that never had one.
      check_in_kind: entry.checkInKind,
      matched_by: entry.matchedBy,
      match_confidence: entry.matchConfidence,
      anchor_source: entry.anchorSource,
      anchor_label: entry.anchorLabel,
      photo_day_ambiguous: entry.photoDayAmbiguous,
      ...(!useR2 && entry.photo ? { photo: entry.photo } : {}),
    })
    await db.observations.update(entry.id, { remoteId: record.id })
    if (useR2 && entry.photo) {
      try {
        const uploaded = await uploadObservationPhoto(record.id, entry.photo)
        await pb.collection('atlas_observations').update(record.id, {
          photo_r2_key: uploaded.key,
          photo_r2_size: uploaded.size,
        })
        await db.observations.update(entry.id, { photoR2Key: uploaded.key, photoR2Size: uploaded.size })
      } catch (error) {
        // The journal entry and its offline photo are safe. pullObservations
        // will retry this R2 upload on a later signed-in Journal visit.
        // A capacity block is actionable, though: let the visible Journal
        // form show the opaque support reference instead of swallowing it.
        if (isAtlasMediaUploadBlockedError(error)) throw error
        trackEvent('sync_failed', { stage: 'push_observation_r2_upload', error: String(error) })
      }
    }
    return record.id
  } catch (error) {
    // Stays local-only; the user still sees it in their Scrapbook.
    if (isAtlasMediaUploadBlockedError(error)) throw error
    trackEvent('sync_failed', { stage: 'push_observation', error: String(error) })
    return null
  }
}
