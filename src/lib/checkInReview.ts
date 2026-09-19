// The reviewed half of a backdated check-in, and the writer that produces one.
//
// A photo-matched past check-in needs no reviewer -- the matcher either found
// an event or it did not, and the entry records which. This module exists for
// the other path: a photo whose time and place could not be matched to
// anything, or a Sky Pass backdate with no photo at all, where the user
// describes the night themselves. That claim goes into a queue and is verified
// by a human. See the plan's "what approval and rejection actually do" -- the
// whole consequence is a city stamp and a label, never a public post.
//
// `savePastCheckIn` at the bottom is the single write path for a backdated
// check-in. It lives here, beside the queue it may feed, because deciding
// *whether* an entry needs review and creating it are the same decision -- and
// because the free-tier photo rule has to have exactly one enforcement point
// that a future caller cannot route around.
//
// Offline-first, like every other write path here. The queue collection on
// PocketBase owns the truth; `reviewStatus` on the Dexie entry is a mirror so
// the Journal can render review state with no network round-trip.
//
// --- circular import, deliberately ---
//
// This module imports `pushObservation` from './sync', and `sync.ts` imports
// `pullReviewSubmissions` from here (it is called at the end of
// `pullObservationsNow`, so review state refreshes on the same visit that
// refreshes the observations). Every one of those references sits inside an
// async function body that only runs long after module initialisation, so
// neither module reads the other's binding at init time and the cycle is
// harmless under ESM. Do not hoist any of them to module scope.

import { pb } from './pocketbase'
import { trackEvent } from './analytics'
import { db, type ObservationLogEntry, type SkyEvent } from './db'
import { isAtlasMediaUploadBlockedError } from './atlasMedia'
import { pushCityStampFromObservation } from './cityStamps'
import { pushObservation } from './sync'
import { fetchPastEventsForDay, isGeneratedPastEventId, PAST_EVENT_ID_PREFIX } from './pastEvents.mjs'
import { checkInPolicyFor, PhotoRequiredError } from './checkInRules'
import { recordWeeklyActivity, weekStart } from './streaks'
import type { PhotoDaySource } from './exifDateTime.mjs'

const QUEUE = 'atlas_checkin_review_queue'

/** The three states a queue row can hold. Never stored locally in this form. */
export type ReviewQueueStatus = 'pending' | 'approved' | 'rejected'

/**
 * The event as the client saw it, carried on the queue row so a reviewer is
 * not staring at a dangling id.
 *
 * A *generated* event is not a `sky_events` row and is not related to -- past
 * events are computed on demand and never persisted, so there is nothing to
 * point a relation at. The snapshot is the only record of what was proposed.
 *
 * Inner keys are snake_case, matching the queue collection's own fields: the
 * reviewer reads this blob raw in the PocketBase admin UI, sat next to
 * `day_key` and `observed_at`.
 */
export interface ReviewEventSnapshot {
  kind: string
  target: string
  title: string
  starts_at: string
  ends_at: string
}

export interface ReviewSubmissionInput {
  /** The Dexie row id. Also the queue row's `local_id` -- see submitForReview. */
  entryId: string
  /** The civil day as resolved, which is not always `observedAt`'s day -- see below. */
  dayKey: string
  dayAmbiguous: boolean
  anchorSource?: ObservationLogEntry['anchorSource']
  eventSnapshot?: ReviewEventSnapshot
  matchedBy?: ObservationLogEntry['matchedBy']
  matchConfidence?: ObservationLogEntry['matchConfidence']
  /**
   * The resolved place, when the caller knows coordinates for it. Omitted
   * means unset, which is stored as 0/0 -- `NumberField` has no null in
   * PocketBase, the same convention eventFilters.ts documents.
   */
  latitude?: number
  longitude?: number
}

/** Turns a generated event into the snapshot the queue row stores. */
export function eventSnapshotFrom(event: SkyEvent): ReviewEventSnapshot {
  return {
    kind: event.kind,
    target: event.target,
    title: event.title,
    starts_at: event.startsAt,
    ends_at: event.endsAt,
  }
}

/**
 * The stable id shape `pastEvents.mjs` gives every generated event:
 * `past-${kind}-${target}-${dayKey}`. Parsing it back is what lets a retry
 * name the right day without a ninth field on the entry.
 *
 * `dayKey` is exactly ten characters ('YYYY-MM-DD'), so the split is
 * unambiguous even though kinds and targets contain their own separators.
 */
function pastEventIdParts(id: string): { dayKey: string } | null {
  if (!isGeneratedPastEventId(id)) return null
  const rest = id.slice(PAST_EVENT_ID_PREFIX.length)
  const dayKey = rest.slice(-10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return null
  return { dayKey }
}

/**
 * The day a retry should claim.
 *
 * Prefers the day baked into a matched event's id, because that is the day the
 * matcher actually resolved. Falls back to the entry's own date.
 *
 * Residual, and the reason this is a comment rather than a blank: when the
 * photo landed within three hours of midnight the day is a coin-flip and the
 * user picked one side of it. If they picked the side the event id does *not*
 * name, and nothing matched, a later retry sends the event-derived day while
 * `observed_at` sits on the other. `day_ambiguous: true` travels with the row
 * in exactly that case, so the reviewer sees that the hedge fired rather than
 * seeing a silent inconsistency.
 */
function dayKeyForEntry(entry: ObservationLogEntry): string {
  const parsed = entry.eventId ? pastEventIdParts(entry.eventId) : null
  return parsed?.dayKey ?? entry.observedAt.slice(0, 10)
}

/**
 * The generated event behind an entry, re-derived offline.
 *
 * Only used by the retry sweep, which has an entry and no in-memory event --
 * `fetchPastEventsForDay` is deterministic and needs no network, so the
 * snapshot it rebuilds is the same one the first attempt would have sent.
 */
async function eventSnapshotFor(entry: ObservationLogEntry): Promise<ReviewEventSnapshot | undefined> {
  if (!isGeneratedPastEventId(entry.eventId)) return undefined
  try {
    const events = await fetchPastEventsForDay(dayKeyForEntry(entry))
    const match = events.find((event) => event.id === entry.eventId)
    return match ? eventSnapshotFrom(match) : undefined
  } catch {
    // A generated-event failure must not block a retry: the queue row is
    // still worth creating, with the event id and no snapshot.
    return undefined
  }
}

function reviewStatusFor(value: unknown): ObservationLogEntry['reviewStatus'] | null {
  return value === 'pending' || value === 'approved' || value === 'rejected' ? value : null
}

/** The user's own row for a local entry, if one was already created. */
async function findQueueRow(localId: string): Promise<{ id: string } | null> {
  const userId = pb.authStore.record?.id
  if (!userId) return null
  try {
    return await pb
      .collection(QUEUE)
      .getFirstListItem(`user = "${userId}" && local_id = "${localId}"`)
  } catch {
    return null
  }
}

/**
 * Sends one entry to the review queue.
 *
 * Ordering is load-bearing and mirrors the plan: mark the intent locally, push
 * the observation (which owns the photo upload), then create the queue row,
 * then flip to `pending`. Returns the queue row id, or null -- and on null the
 * entry is left `'unsent'`, which is the state the sweep in
 * `pullReviewSubmissions` retries. `'unsent'` is required rather than
 * cosmetic: without it, a submission made offline would render as `pending`
 * forever with nothing actually queued.
 *
 * The photo goes to R2 through `pushObservation`, which is the only media path
 * for an observation photo, and the key is then copied onto the queue row so a
 * reviewer can look at it. When R2 is not enabled the photo is an inline
 * PocketBase file on the observation instead and there is no key to copy -- the
 * reviewer follows `observation_remote_id` to see it.
 */
export async function submitForReview(input: ReviewSubmissionInput): Promise<string | null> {
  if (!pb.authStore.isValid || !navigator.onLine) return null

  const entry = await db.observations.get(input.entryId)
  if (!entry) return null

  const locationLabel = entry.locationLabel?.trim()
  const userId = pb.authStore.record?.id
  if (!locationLabel || !userId) {
    // A place is the one thing a reviewer cannot reconstruct, and the queue
    // row requires it. The sheet collects it before this is reachable.
    trackEvent('sync_failed', { stage: 'submit_checkin_review', error: 'missing location label' })
    return null
  }

  await db.observations.update(entry.id, { reviewStatus: 'unsent' })

  let remoteId = entry.remoteId
  if (!remoteId) {
    try {
      remoteId = (await pushObservation(entry)) ?? undefined
    } catch (error) {
      if (isAtlasMediaUploadBlockedError(error)) throw error
      remoteId = undefined
    }
  }
  if (!remoteId) return null // still 'unsent'; the next pull retries

  // pushObservation writes photoR2Key back to the row once the upload lands,
  // so read it back rather than uploading a second copy to the same key.
  const uploaded = await db.observations.get(entry.id)

  const payload = {
    observed_at: entry.observedAt,
    // Deliberately not derived from observed_at: when the timezone was
    // unknown the disputed value is the day, not the instant.
    day_key: input.dayKey,
    day_ambiguous: input.dayAmbiguous,
    location_label: locationLabel,
    latitude: input.latitude ?? 0,
    longitude: input.longitude ?? 0,
    anchor_source: input.anchorSource ?? 'manual',
    observation_remote_id: remoteId,
    ...(entry.eventId ? { event_id: entry.eventId } : {}),
    ...(input.eventSnapshot ? { event_snapshot: input.eventSnapshot } : {}),
    ...(entry.note ? { note: entry.note } : {}),
    ...(uploaded?.photoR2Key ? { photo_r2_key: uploaded.photoR2Key } : {}),
    ...(uploaded?.photoR2Size ? { photo_r2_size: uploaded.photoR2Size } : {}),
    matched_by: input.matchedBy ?? 'manual',
    match_confidence: input.matchConfidence ?? 'none',
  }

  try {
    // Idempotent: `local_id` is the Dexie row id, and the collection has a
    // unique (user, local_id) index, so a retry after a partial failure
    // updates its own row instead of colliding with it.
    const existing = await findQueueRow(entry.id)
    const row = existing
      ? await pb.collection(QUEUE).update(existing.id, payload)
      : await pb.collection(QUEUE).create({ user: userId, local_id: entry.id, status: 'pending', ...payload })

    await db.observations.update(entry.id, { reviewStatus: 'pending', reviewSubmissionId: row.id })
    return row.id as string
  } catch (error) {
    trackEvent('sync_failed', { stage: 'submit_checkin_review', error: String(error) })
    return null
  }
}

/**
 * Withdraws a pending submission.
 *
 * The entry stays in the diary -- the user is withdrawing the *claim*, not the
 * night -- but it stops counting toward city stamps, because nothing was ever
 * credited remotely for it and a local count that the remote does not have is
 * the disagreement cityStamps.ts exists to avoid.
 *
 * `'withdrawn'` is its own state rather than a reuse of `'rejected'` (which is
 * the reviewer's word, not the user's) or `'unsent'` (which the sweep would
 * helpfully resubmit).
 */
export async function withdrawSubmission(entryId: string): Promise<void> {
  if (!pb.authStore.isValid || !navigator.onLine) return

  const entry = await db.observations.get(entryId)
  if (!entry) return

  try {
    if (entry.reviewSubmissionId) {
      await pb.collection(QUEUE).delete(entry.reviewSubmissionId)
    } else {
      const existing = await findQueueRow(entryId)
      if (existing) await pb.collection(QUEUE).delete(existing.id)
    }
  } catch (error) {
    trackEvent('sync_failed', { stage: 'withdraw_checkin_review', error: String(error) })
    return // leave it pending rather than claim a withdrawal that did not happen
  }

  await db.observations.update(entryId, { reviewStatus: 'withdrawn', reviewSubmissionId: undefined })
}

/**
 * Credits a city stamp for each entry that has just been approved.
 *
 * Takes the entries rather than re-deriving them, because the only moment the
 * information exists is the transition: a no-argument version would re-credit
 * every already-approved entry on every pull and inflate `checkin_count` with
 * no decrement path. Approval is the one point a human decision becomes a
 * stamp, and it reuses the existing push verbatim.
 *
 * Best-effort, matching the photo-matched path and the existing contract of
 * `pushCityStampFromObservation`, which swallows its own failures: a missed
 * stamp is preferable to a retry ledger for a cosmetic count.
 */
export async function reconcileApprovedStamps(entries: ObservationLogEntry[]): Promise<void> {
  for (const entry of entries) {
    await pushCityStampFromObservation(entry)
  }
}

/**
 * Mirrors queue state onto the local entries and retries anything unsent.
 *
 * Called at the end of `pullObservationsNow` -- one sync entry point, and the
 * Journal already awaits `pullObservations()`, so review state refreshes on the
 * same visit with no new call site.
 */
export async function pullReviewSubmissions(): Promise<void> {
  const userId = pb.authStore.record?.id
  if (!userId || !pb.authStore.isValid || !navigator.onLine) return

  try {
    const rows = await pb.collection(QUEUE).getFullList({ sort: '-created' })

    // `reviewStatus` is deliberately not indexed (it was added to a Dexie
    // table without a version bump), so the lookup goes through the indexed
    // `userId` and filters in memory.
    const mine = await db.observations.where('userId').equals(userId).toArray()
    const byLocalId = new Map(mine.map((entry) => [entry.id, entry]))

    const flips: Array<{ id: string; status: ObservationLogEntry['reviewStatus']; submissionId: string }> = []
    const newlyApproved: ObservationLogEntry[] = []

    for (const row of rows) {
      const localId = typeof row.local_id === 'string' ? row.local_id : ''
      const entry = byLocalId.get(localId)
      if (!entry) continue

      const status = reviewStatusFor(row.status)
      if (!status) continue
      if (entry.reviewStatus === status && entry.reviewSubmissionId === row.id) continue

      if (status === 'approved' && entry.reviewStatus !== 'approved') newlyApproved.push(entry)
      flips.push({ id: entry.id, status, submissionId: row.id as string })
    }

    // Stamps before the status flip: if this throws, the entries are still
    // `pending` and the next pull retries them. The reverse order would leave
    // an approved entry whose stamp was never attempted, with nothing to
    // notice it from.
    await reconcileApprovedStamps(newlyApproved)

    for (const flip of flips) {
      await db.observations.update(flip.id, { reviewStatus: flip.status, reviewSubmissionId: flip.submissionId })
    }

    await sweepUnsent(userId)
  } catch (error) {
    trackEvent('sync_failed', { stage: 'pull_checkin_review', error: String(error) })
  }
}

/**
 * Retries every entry still marked `'unsent'`.
 *
 * This is what makes the offline contract in the plan true: `uploadObservationPhoto`
 * hangs off the remote observation id, so `pushObservation` has to succeed
 * first and it returns null offline -- a submission made on a plane would
 * otherwise sit at `'pending'` in the UI forever with no row behind it.
 */
async function sweepUnsent(userId: string): Promise<void> {
  const mine = await db.observations.where('userId').equals(userId).toArray()
  const unsent = mine.filter((entry) => entry.reviewStatus === 'unsent')

  for (const entry of unsent) {
    try {
      await submitForReview({
        entryId: entry.id,
        dayKey: dayKeyForEntry(entry),
        dayAmbiguous: entry.photoDayAmbiguous === true,
        anchorSource: entry.anchorSource,
        eventSnapshot: await eventSnapshotFor(entry),
        matchedBy: entry.matchedBy,
        matchConfidence: entry.matchConfidence,
      })
    } catch (error) {
      // submitForReview handles its own failures; this only catches the
      // media-blocked error it deliberately rethrows. Swallowed per entry so
      // one blocked photo cannot stall the rest of the sweep.
      trackEvent('sync_failed', { stage: 'sweep_checkin_review', error: String(error) })
    }
  }
}

/** Everything the sheet resolved, handed over in one piece. */
export interface PastCheckInInput {
  /** Whose diary this joins -- the signed-in account, or `'local'` signed out. */
  userId: string
  /** The civil day as resolved. Never empty: the sheet will not submit without one. */
  dayKey: string
  /**
   * Which evidence decided the day. `'user'` means the person picked it,
   * which is the honest answer both from a stripped-EXIF photo and from the
   * no-photo Sky Pass path.
   */
  daySource: PhotoDaySource
  /** The daylight-boundary hedge fired -- the date is a judgement call. */
  dayAmbiguous: boolean
  /**
   * The true UTC instant, or null when the photo's time could not be trusted.
   * Null is what puts a photo in the `weak` band rather than rejecting it, and
   * is why this is stored separately from the day.
   */
  instant: Date | null
  placeLabel: string
  latitude: number | null
  longitude: number | null
  placeSource: 'photo' | 'anchor' | 'city' | 'current' | 'manual'
  anchorSource?: ObservationLogEntry['anchorSource']
  anchorLabel?: string
  photo?: File | null
  matchedEvent?: SkyEvent | null
  matchConfidence: ObservationLogEntry['matchConfidence']
  matchedBy: ObservationLogEntry['matchedBy']
  note?: string
  /** Read from `useAuth()`, not re-fetched: the sheet and the writer must agree. */
  entitled: boolean
}

export interface PastCheckInResult {
  /** The Dexie row id. */
  id: string
  /** True when the entry is waiting on a human rather than standing on its own. */
  sentToReview: boolean
}

/**
 * Saves a backdated check-in, and decides whether it goes to the queue.
 *
 * The review rule is one sentence: **an entry stands on its own only when the
 * photo's own metadata supplied the day and the place, neither of them was a
 * judgement call, and the matcher tied it to a real event.** Anything else is
 * a claim about the past with nothing behind it, so a person looks at it.
 * Concretely that sends to review: no photo at all (the Sky Pass backdate),
 * a stripped-EXIF photo, a photo the matcher could not place, a photo whose
 * GPS the user corrected, and a photo within three hours of midnight where
 * the day is a coin-flip.
 *
 * Enforces the free-tier photo rule itself rather than trusting the sheet.
 * The sheet already disables submit, so reaching the throw means a caller went
 * around the UI -- and the plan's whole point in having one table
 * (`checkInRules.ts`) is that the UI and the writer cannot drift apart.
 */
export async function savePastCheckIn(input: PastCheckInInput): Promise<PastCheckInResult> {
  if (checkInPolicyFor('past', input.entitled).photoRequired && !input.photo) {
    throw new PhotoRequiredError()
  }

  const placeLabel = input.placeLabel.trim()
  if (!input.dayKey || !placeLabel) {
    // Both are required by the queue collection and both are things only the
    // person can supply, so an empty one is a caller bug rather than user input.
    throw new Error('A backdated check-in needs a day and a place.')
  }

  const id = crypto.randomUUID()

  // A no-photo entry has no instant to record, and `observedAt` is non-optional.
  // Local noon of the chosen day is the same stand-in `pastCheckInAnchors`
  // queries with: it never shifts the local date, and it reads back as the
  // right day in the diary's own formatter.
  const observedAt = (input.instant ?? new Date(`${input.dayKey}T12:00:00`)).toISOString()

  const selfEvidenced =
    input.photo != null &&
    input.placeSource === 'photo' &&
    !input.dayAmbiguous &&
    (input.daySource === 'exif' || input.daySource === 'gps') &&
    input.matchedEvent != null

  const entry: ObservationLogEntry = {
    id,
    userId: input.userId,
    observedAt,
    locationLabel: placeLabel,
    checkInKind: 'past',
    matchConfidence: input.matchConfidence,
    matchedBy: input.matchedBy,
    // `'unsent'` rather than `'pending'`: the queue row does not exist yet, and
    // a submission made offline has to be retryable. Marking it `'pending'`
    // here would render as "sent for review" forever with nothing behind it.
    reviewStatus: selfEvidenced ? 'not_required' : 'unsent',
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    ...(input.photo ? { photo: input.photo } : {}),
    ...(input.matchedEvent ? { eventId: input.matchedEvent.id, targetName: input.matchedEvent.title } : {}),
    ...(input.anchorSource ? { anchorSource: input.anchorSource } : {}),
    ...(input.anchorLabel ? { anchorLabel: input.anchorLabel } : {}),
    ...(input.dayAmbiguous ? { photoDayAmbiguous: true } : {}),
  }

  await db.observations.add(entry)

  trackEvent('Checked in to a past night', {
    daySource: input.daySource,
    placeSource: input.placeSource,
    ambiguous: input.dayAmbiguous,
    hasPhoto: input.photo != null,
    confidence: input.matchConfidence,
    sentToReview: !selfEvidenced,
  })

  if (!selfEvidenced) {
    await submitForReview({
      entryId: id,
      dayKey: input.dayKey,
      dayAmbiguous: input.dayAmbiguous,
      anchorSource: input.anchorSource,
      eventSnapshot: input.matchedEvent ? eventSnapshotFrom(input.matchedEvent) : undefined,
      matchedBy: input.matchedBy,
      matchConfidence: input.matchConfidence,
      latitude: input.latitude ?? undefined,
      longitude: input.longitude ?? undefined,
    })
    return { id, sentToReview: true }
  }

  // Matched from its own photo, so nothing human is pending -- the entry is
  // a finished thing and gets the same treatment as a tonight check-in.
  try {
    await pushObservation(entry)
  } catch (error) {
    // A failed push leaves the entry local-only, which is the contract
    // pushObservation already documents; it is not a reason to lose the night.
    trackEvent('sync_failed', { stage: 'push_past_checkin', error: String(error) })
  }
  await pushCityStampFromObservation(entry)

  // Only when the backdated night is *this* week. `recordWeeklyActivity`
  // derives the week from its argument and writes it back as the last active
  // week, so handing it a 2019 date would compute a multi-year gap, reset the
  // streak to 1 and corrupt a live one. Backdating is not evidence that anyone
  // went outside this week, so outside this week it is simply not recorded.
  if (weekStart(new Date(observedAt)) === weekStart(new Date())) {
    await recordWeeklyActivity()
  }

  return { id, sentToReview: false }
}
