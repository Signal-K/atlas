import { useEffect, useState } from 'react'
import { Sheet } from './Sheet'
import { useToast } from './Toast'
import type { ObservationLogEntry, SkyEvent } from '../../lib/db'
import { useAuth } from '../../lib/auth'
import { pb } from '../../lib/pocketbase'
import { trackEvent } from '../../lib/analytics'
import { isAtlasMediaEnabled } from '../../lib/atlasMedia'
import { optimizeObservationPhoto, PhotoOptimizationError } from '../../lib/photoOptimization'
import { extractPhotoExif, type PhotoExif } from '../../lib/exifExtract'
import { resolvePhotoDay, type PhotoDaySource } from '../../lib/exifDateTime.mjs'
import { identifySky, type SkyPhotoIdResult } from '../../lib/skyPhotoId'
import { fetchPastEventsForDay } from '../../lib/pastEvents.mjs'
import { rankPastEventCandidates, type CheckInConfidence, type RankedCandidate } from '../../lib/pastCheckInMatch.mjs'
import { anchorsForDate, needsAnchorChoice, type PastAnchor } from '../../lib/pastCheckInAnchors'
import { checkInPolicyFor, PhotoRequiredError } from '../../lib/checkInRules'
import { savePastCheckIn } from '../../lib/checkInReview'
import { findNearestCity, cityLabel, haversineKm } from '../../lib/cities'
import { categoryForKind } from '../../lib/eventCategories'
import { LocationSearchInput } from '../LocationSearchInput'
import type { CurrentLocation } from '../../lib/currentLocation'

const LOCAL_USER_ID = 'local'

// Past this far from the nearest curated city, the city's name is a worse
// answer than the coordinates themselves -- calling a mid-Atlantic photo
// "Reykjavik" is a lie the user then has to notice and correct.
const CITY_LABEL_RADIUS_KM = 100

/** 'YYYY-MM-DD' in the viewer's own zone -- what an `<input type="date">` speaks. */
function dayKeyOf(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

/** '14 Aug 2019' -- the day as a person would say it back to you. */
function formatDay(dayKey: string): string {
  return new Date(`${dayKey}T12:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** A place name for a coordinate, falling back to the coordinate itself. */
function placeLabelFor(lat: number, lon: number): string {
  const city = findNearestCity(lat, lon)
  return haversineKm(city, { lat, lon }) <= CITY_LABEL_RADIUS_KM
    ? cityLabel(city)
    : `${lat.toFixed(2)}, ${lon.toFixed(2)}`
}

/**
 * Why this candidate is in the list, in the user's terms.
 *
 * The ranker's reason codes are machine-readable and deliberately not
 * user-facing copy (`pastCheckInMatch.mjs` is called directly by the test
 * suite). This is the only place they become English, and the fallback is
 * worded so a code added later degrades to something true rather than blank.
 */
const REASON_LABEL: Record<string, string> = {
  'frame-match': 'The photo shows this',
  'flagship-kind': 'Ran all evening, so the time fits',
  'moon-phase-needs-frame': 'A moon phase — the photo has to confirm it',
  'frame-disagrees': 'The photo shows something else',
  'no-trustworthy-time': 'We couldn’t read a time from this photo',
  unconfirmed: 'Nothing in the photo confirms it',
}

function reasonLabel(candidate: RankedCandidate): string {
  for (const reason of candidate.reasons) {
    const label = REASON_LABEL[reason]
    if (label) return label
  }
  return 'Overlaps the time on your photo'
}

/** How the day was arrived at, shown under the date input. */
const DAY_SOURCE_NOTE: Record<PhotoDaySource, string> = {
  exif: 'Taken from the timestamp in your photo.',
  gps: 'Taken from your photo’s GPS clock, which is always in UTC.',
  longitude: 'Estimated from where the photo was taken — check it looks right.',
  user: 'You picked this.',
}

/** Named so the provenance line under the place can explain an anchor. */
const ANCHOR_NOTE: Record<string, string> = {
  trip: 'From your trip',
  'trip-plan': 'From your trip plan',
  'journal-location': 'From where you checked in that week',
  'current-location': 'From where you are now — change it if that’s wrong',
  manual: 'You told us',
}

export interface PastCheckInSheetProps {
  open: boolean
  onClose: () => void
  currentLocation: CurrentLocation
  /**
   * Navigate to where Sky Pass lives. The inline card below never starts a
   * checkout itself — the established mobile pattern is to send the user to
   * Profile, and a mid-flow purchase would discard the day and place they
   * have already entered.
   */
  onUpgradeClick: () => void
  /** Called after a successful save so the Journal can refresh its list. */
  onSaved: () => void
}

export function PastCheckInSheet({ open, onClose, currentLocation, onUpgradeClick, onSaved }: PastCheckInSheetProps) {
  const { user } = useAuth()
  const toast = useToast()
  const scopeId = user?.id ?? LOCAL_USER_ID
  const policy = checkInPolicyFor('past', user?.entitled === true)

  const [photo, setPhoto] = useState<File | null>(null)
  const [exif, setExif] = useState<PhotoExif | null>(null)
  const [readingPhoto, setReadingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoPreparing, setPhotoPreparing] = useState(false)

  const [dayKey, setDayKey] = useState('')
  /** The other plausible day when the daylight hedge fires — drives the two-chip prompt. */
  const [dayKeyAlt, setDayKeyAlt] = useState<string | null>(null)
  const [dayAmbiguous, setDayAmbiguous] = useState(false)
  const [daySource, setDaySource] = useState<PhotoDaySource>('user')
  /** The true UTC instant, or null when the photo's time could not be trusted. */
  const [instantMs, setInstantMs] = useState<number | null>(null)

  const [placeLabel, setPlaceLabel] = useState('')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [placeSource, setPlaceSource] = useState<'photo' | 'anchor' | 'city' | 'current' | 'manual'>('manual')
  const [anchorSource, setAnchorSource] = useState<ObservationLogEntry['anchorSource']>()
  const [anchorLabel, setAnchorLabel] = useState<string | undefined>()

  const [anchors, setAnchors] = useState<PastAnchor[]>([])
  const [anchorsLoading, setAnchorsLoading] = useState(false)
  const [placeQuery, setPlaceQuery] = useState('')

  const [candidates, setCandidates] = useState<RankedCandidate[]>([])
  const [confidence, setConfidence] = useState<CheckInConfidence>('none')
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [matching, setMatching] = useState(false)

  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const todayKey = dayKeyOf(new Date())
  // The account's own start date, for the soft floor below. Read straight off
  // the auth record because `AuthUser` does not carry it -- and it is advisory
  // copy only, never a validation.
  const joinedCreated = pb.authStore.record?.created
  const joinedKey = typeof joinedCreated === 'string' ? joinedCreated.slice(0, 10) : ''

  // Sheet.tsx unmounts its children while closed, but this component keeps its
  // hooks alive across opens (it owns the <Sheet>, not the other way round) --
  // reset explicitly on every open instead of relying on unmount. Same reason
  // as CaptureSheet.
  useEffect(() => {
    if (!open) return
    setPhoto(null)
    setExif(null)
    setReadingPhoto(false)
    setPhotoError(null)
    setPhotoPreparing(false)
    setDayKey('')
    setDayKeyAlt(null)
    setDayAmbiguous(false)
    setDaySource('user')
    setInstantMs(null)
    setPlaceLabel('')
    setLatitude(null)
    setLongitude(null)
    setPlaceSource('manual')
    setAnchorSource(undefined)
    setAnchorLabel(undefined)
    setAnchors([])
    setAnchorsLoading(false)
    setPlaceQuery('')
    setCandidates([])
    setConfidence('none')
    setSelectedEventId(null)
    setMatching(false)
    setNote('')
    setSaving(false)
  }, [open])

  const photoHasGps = exif?.lat != null && exif?.lon != null

  // --- Photo -> day + place -------------------------------------------------

  async function handlePhoto(file: File | null) {
    setPhoto(file)
    setPhotoError(null)
    setExif(null)
    if (!file) return

    setReadingPhoto(true)
    const read = await extractPhotoExif(file)
    setReadingPhoto(false)
    setExif(read)

    if (read.dateTimeOriginal == null) {
      // No usable timestamp: the day is the user's to pick, and with no instant
      // to match on the entry lands in the `weak` band.
      setDaySource('user')
      setInstantMs(null)
    } else {
      // `exifExtract` set dateTimeOriginal = naive - offset, so adding the
      // offset back recovers the naive wall-clock reading the day resolver
      // needs. Its exact integer inverse, not an approximation.
      const resolved = resolvePhotoDay({
        naiveUtcMs: read.dateTimeOriginal.getTime() + (read.offsetMinutes ?? 0) * 60_000,
        offsetMinutes: read.offsetMinutes,
        offsetSource: read.offsetSource,
        longitudeDeg: read.lon,
      })

      setDayKey(resolved.dayKey ?? '')
      setDayKeyAlt(resolved.dayKeyAlt)
      setDayAmbiguous(resolved.ambiguous)
      // `resolvePhotoDay` reports `'longitude'` for the unknown-offset case too,
      // where it has silently fallen back to a zero shift. That is not longitude
      // evidence, and calling it that would let the writer treat an untrusted
      // date as self-evidenced. No offset evidence means the person confirms.
      setDaySource(read.offsetSource === 'unknown' ? 'user' : resolved.source)
      // With no offset evidence the recovered instant is the wall clock misread
      // as UTC, off by up to fourteen hours. Not a time to match on.
      setInstantMs(read.offsetSource === 'unknown' || resolved.utcMs == null ? null : resolved.utcMs)
    }

    if (read.lat != null && read.lon != null) {
      setLatitude(read.lat)
      setLongitude(read.lon)
      setPlaceLabel(placeLabelFor(read.lat, read.lon))
      setPlaceSource('photo')
      setAnchorSource(undefined)
      setAnchorLabel(undefined)
      setPlaceQuery('')
    }
  }

  // --- Place, when the photo did not supply one -----------------------------

  // `currentLocation` is unpacked into primitives rather than depended on as an
  // object: it is rebuilt on every render, so an object dependency here would
  // refetch the anchors on every keystroke.
  const fallbackName = currentLocation.name
  const fallbackLat = currentLocation.lat
  const fallbackLon = currentLocation.lon

  useEffect(() => {
    if (!open || !dayKey || photoHasGps) {
      setAnchors([])
      return
    }
    let cancelled = false
    setAnchorsLoading(true)
    anchorsForDate(dayKey, scopeId, { name: fallbackName, lat: fallbackLat, lon: fallbackLon })
      .then((list) => {
        if (cancelled) return
        setAnchors(list)
        // Exactly one anchor is not a choice, it is an answer -- see
        // `needsAnchorChoice`. Zero is different: it means manual entry.
        if (list.length === 1) applyAnchor(list[0])
      })
      .catch(() => {
        if (!cancelled) setAnchors([])
      })
      .finally(() => {
        if (!cancelled) setAnchorsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, dayKey, photoHasGps, scopeId, fallbackName, fallbackLat, fallbackLon])

  function applyAnchor(anchor: PastAnchor) {
    setLatitude(anchor.lat)
    setLongitude(anchor.lon)
    setPlaceLabel(anchor.label)
    setPlaceSource('anchor')
    setAnchorSource(anchor.source)
    setAnchorLabel(anchor.label)
  }

  // --- Matching -------------------------------------------------------------

  // Re-runs whenever the day, the place or the instant changes, which includes
  // the user answering the midnight prompt. Every input is deterministic and
  // offline, so this is a pure recomputation with no network cost to debounce.
  useEffect(() => {
    if (!open || !dayKey || latitude == null || longitude == null) {
      setCandidates([])
      setConfidence('none')
      setSelectedEventId(null)
      return
    }

    let cancelled = false
    setMatching(true)
    const instant = instantMs != null ? new Date(instantMs) : null
    const headingDeg = exif?.headingDeg ?? null

    fetchPastEventsForDay(dayKey)
      .then((events) => {
        // The frame is only analysed when the photo carried a trustworthy time
        // to place it by. A failed identification is not a rejection -- the
        // ranker reads a missing result as "no opinion", never as a mismatch.
        let identified: SkyPhotoIdResult | null = null
        if (photo && instant) {
          try {
            identified = identifySky({ date: instant, lat: latitude, lon: longitude, headingDeg: headingDeg ?? undefined })
          } catch {
            identified = null
          }
        }

        const ranked = rankPastEventCandidates(events, { lat: latitude, lon: longitude, instant, headingDeg, identified })
        if (cancelled) return
        setCandidates(ranked.candidates)
        setConfidence(ranked.confidence)
        // Only a `strong` band is pre-selected. A `possible` or `weak` row is
        // offered, never assumed -- a disagreement is shown, not hidden.
        setSelectedEventId(ranked.confidence === 'strong' ? ranked.candidates[0]?.event.id ?? null : null)
      })
      .catch(() => {
        if (cancelled) return
        setCandidates([])
        setConfidence('none')
        setSelectedEventId(null)
      })
      .finally(() => {
        if (!cancelled) setMatching(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, dayKey, latitude, longitude, instantMs, photo, exif?.headingDeg])

  // --- Submit ---------------------------------------------------------------

  const selectedCandidate = candidates.find((candidate) => candidate.event.id === selectedEventId) ?? null
  const selectedEvent: SkyEvent | null = selectedCandidate?.event ?? null
  const photoMissing = policy.photoRequired && photo == null
  const noPlace = latitude == null || longitude == null || placeLabel.trim() === ''
  // Nothing was matched, so the user's own description is the only thing a
  // reviewer has to go on.
  const needsDescription = selectedEvent == null
  const canSubmit =
    dayKey !== '' && !noPlace && !photoMissing && !saving && !readingPhoto && (!needsDescription || note.trim() !== '')

  const placeNote =
    placeSource === 'photo'
      ? 'From your photo’s GPS'
      : placeSource === 'city'
        ? 'You told us'
        : (ANCHOR_NOTE[anchorSource ?? 'manual'] ?? 'You told us')

  async function handleSave(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    setSaving(true)

    let entryPhoto: File | null = photo
    if (photo && isAtlasMediaEnabled()) {
      setPhotoPreparing(true)
      setPhotoError(null)
      try {
        entryPhoto = await optimizeObservationPhoto(photo)
      } catch (error) {
        setPhotoError(
          error instanceof PhotoOptimizationError ? error.message : 'This photo could not be prepared for upload.',
        )
        setPhotoPreparing(false)
        setSaving(false)
        return
      }
      setPhotoPreparing(false)
    }

    // How the entry was tied to an event. A no-photo backdate picked the same
    // list by hand, so `manual` is the honest value there even though the
    // candidates themselves were machine-generated.
    const matchedBy: ObservationLogEntry['matchedBy'] =
      photo == null || instantMs == null ? 'manual' : exif?.headingDeg != null ? 'photo-exif-heading' : 'photo-exif'

    try {
      const result = await savePastCheckIn({
        userId: scopeId,
        dayKey,
        daySource,
        dayAmbiguous,
        instant: instantMs != null ? new Date(instantMs) : null,
        placeLabel,
        latitude,
        longitude,
        placeSource,
        anchorSource,
        anchorLabel,
        photo: entryPhoto,
        matchedEvent: selectedEvent,
        matchConfidence: selectedCandidate?.confidence ?? 'none',
        matchedBy,
        note,
        entitled: user?.entitled === true,
      })

      // The two outcomes read differently on purpose: one is a diary entry, the
      // other is a claim waiting on a person. Calling both "saved" would keep
      // the review queue invisible until it silently did nothing.
      toast(
        result.sentToReview
          ? 'Sent for review — we’ll add it to your city stamps once it’s approved.'
          : 'Night added to your diary.',
      )
      onSaved()
      onClose()
    } catch (error) {
      if (error instanceof PhotoRequiredError) {
        setPhotoError(error.message)
      } else {
        toast('We couldn’t save this one. Please try again.')
      }
      trackEvent('sync_failed', { stage: 'save_past_checkin', error: String(error) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} title="Check in to a past night" onClose={onClose}>
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Inline, not PaywallGate: a full-screen gate here would throw away the
            day and place the user has already entered. */}
        {policy.photoRequired && (
          <div style={{ background: 'var(--chip)', borderRadius: '0.75rem', padding: '0.625rem 0.75rem' }}>
            <span className="az-kicker">Sky Pass</span>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem' }}>{policy.photoRequiredReason}</p>
            <button
              type="button"
              className="az-btn az-btn-outline az-btn-block"
              style={{ marginTop: '0.5rem' }}
              onClick={() => {
                trackEvent('Blocked free plan add', { action: 'past_checkin', source: 'journal' })
                onUpgradeClick()
              }}
            >
              See Sky Pass
            </button>
          </div>
        )}

        <div>
          <span className="az-kicker">The photo</span>
          <label
            className="az-btn az-btn-outline az-btn-block"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              marginTop: '0.4375rem',
            }}
            htmlFor="past-checkin-photo"
          >
            {photo ? photo.name : policy.photoRequired ? 'Choose a photo' : 'Add a photo (optional)'}
          </label>
          <input
            id="past-checkin-photo"
            type="file"
            accept="image/*"
            hidden
            onChange={(inputEvent) => {
              void handlePhoto(inputEvent.target.files?.[0] ?? null)
            }}
          />
          {readingPhoto && (
            <p className="az-muted" style={{ margin: '0.375rem 0 0', fontSize: '0.71875rem' }}>
              Reading the time and place from your photo…
            </p>
          )}
          {photoError && (
            <p role="alert" style={{ color: 'var(--az-amber-strong)', fontSize: '0.75rem', margin: '0.375rem 0 0' }}>
              {photoError}
            </p>
          )}
        </div>

        <div>
          <span className="az-kicker">Which night?</span>
          <input
            type="date"
            className="az-input"
            style={{ marginTop: '0.4375rem' }}
            max={todayKey}
            value={dayKey}
            onChange={(inputEvent) => {
              // A hand-picked day is the user's answer, not the photo's. The
              // hedge does not apply to it, and the writer must not treat it as
              // self-evidenced.
              setDayKey(inputEvent.target.value)
              setDayKeyAlt(null)
              setDayAmbiguous(false)
              if (inputEvent.target.value !== '') setDaySource('user')
            }}
            required
          />
          {dayKey && (
            <p className="az-muted" style={{ margin: '0.375rem 0 0', fontSize: '0.71875rem' }}>
              {DAY_SOURCE_NOTE[daySource]}
            </p>
          )}
          {/* Soft floor, never a hard block: photos from before the account
              existed are the feature's whole premise. */}
          {dayKey && joinedKey && dayKey < joinedKey && (
            <p className="az-muted" style={{ margin: '0.25rem 0 0', fontSize: '0.71875rem' }}>
              You joined Atlas on {formatDay(joinedKey)} — is {formatDay(dayKey)} right?
            </p>
          )}
        </div>

        {/* The daylight-boundary hedge. Two chips, never a silent pick: with an
            inexact offset the date is a coin-flip and only the person knows. */}
        {dayAmbiguous && dayKeyAlt && (
          <div>
            <span className="az-kicker">Which side of midnight?</span>
            <div className="az-chip-row" style={{ marginTop: '0.4375rem' }}>
              {[dayKey, dayKeyAlt].map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`az-chip${dayKey === option ? ' is-active' : ''}`}
                  onClick={() => setDayKey(option)}
                >
                  {formatDay(option)}
                </button>
              ))}
            </div>
            <p className="az-muted" style={{ margin: '0.375rem 0 0', fontSize: '0.71875rem' }}>
              The photo was taken close to midnight, so the date is a guess — either way we’ll keep it flagged.
            </p>
          </div>
        )}

        <div>
          <span className="az-kicker">Where were you?</span>
          {placeLabel ? (
            <div
              style={{
                background: 'var(--chip)',
                borderRadius: '0.75rem',
                padding: '0.625rem 0.75rem',
                marginTop: '0.4375rem',
              }}
            >
              <strong style={{ display: 'block', fontSize: '0.9375rem' }}>{placeLabel}</strong>
              <span className="az-muted" style={{ fontSize: '0.71875rem' }}>
                {placeNote}
              </span>
            </div>
          ) : (
            <p className="az-muted" style={{ margin: '0.375rem 0 0', fontSize: '0.71875rem' }}>
              {anchorsLoading
                ? 'Looking for where you were that day…'
                : anchors.length > 0
                  ? 'Pick the place, or search for another.'
                  : 'We couldn’t find a place for this day — tell us where you were.'}
            </p>
          )}

          {/* Places the user has already asserted about that date: a saved trip,
              a trip-plan leg, or a nearby journal check-in. Offered before the
              search box because they are restatements, not new claims. */}
          {!photoHasGps && needsAnchorChoice(anchors) && (
            <div className="az-chip-row" style={{ marginTop: '0.4375rem' }}>
              {anchors.map((anchor) => (
                <button
                  key={`${anchor.source}:${anchor.label}`}
                  type="button"
                  className={`az-chip${anchorSource === anchor.source && anchorLabel === anchor.label ? ' is-active' : ''}`}
                  onClick={() => applyAnchor(anchor)}
                >
                  {anchor.label}
                </button>
              ))}
            </div>
          )}

          {/* Always available when the photo carried no GPS, including to a free
              user: this is the check-in's own place, not the settings-level "set
              any location" perk that sits behind Sky Pass. */}
          {!photoHasGps && (
            <div style={{ marginTop: '0.5rem' }}>
              <LocationSearchInput
                id="past-checkin-place"
                value={placeQuery}
                onChange={setPlaceQuery}
                onSelect={(city) => {
                  setPlaceLabel(cityLabel(city))
                  setLatitude(city.lat)
                  setLongitude(city.lon)
                  setPlaceSource('city')
                  setAnchorSource(undefined)
                  setAnchorLabel(undefined)
                  setPlaceQuery(cityLabel(city))
                }}
                placeholder="Search for the place"
              />
            </div>
          )}
        </div>

        {/* Candidates. `strong` is pre-selected and reads as a statement with an
            escape hatch; `possible` and `weak` read as a list to choose from. */}
        {dayKey && !noPlace && (
          <div>
            <span className="az-kicker">{matching ? 'Checking that night’s sky…' : 'What was on that night'}</span>
            {!matching && candidates.length === 0 && (
              <p className="az-muted" style={{ margin: '0.375rem 0 0', fontSize: '0.71875rem' }}>
                We couldn’t identify an event from the photo’s time and place. Describe the night yourself and we’ll
                review it before it counts toward your city stamps.
              </p>
            )}
            {!matching && candidates.length > 0 && (
              <>
                {confidence === 'strong' && selectedCandidate && (
                  <p style={{ margin: '0.375rem 0 0', fontSize: '0.8125rem' }}>
                    This looks like <strong>{selectedCandidate.event.title}</strong> on {formatDay(dayKey)}.
                  </p>
                )}
                {confidence !== 'strong' && (
                  <p className="az-muted" style={{ margin: '0.375rem 0 0', fontSize: '0.71875rem' }}>
                    {confidence === 'weak'
                      ? 'We couldn’t read a time from the photo, so these are everything that night. Pick one, or describe it yourself.'
                      : 'More than one thing was happening that night. Pick the one you saw.'}
                  </p>
                )}
                <div className="az-row-group" style={{ marginTop: '0.4375rem' }}>
                  {candidates.map((candidate) => (
                    <button
                      key={candidate.event.id}
                      type="button"
                      className="az-row"
                      aria-pressed={selectedEventId === candidate.event.id}
                      style={
                        selectedEventId === candidate.event.id
                          ? { outline: '2px solid var(--az-amber-strong)', outlineOffset: '-2px' }
                          : undefined
                      }
                      onClick={() =>
                        setSelectedEventId(selectedEventId === candidate.event.id ? null : candidate.event.id)
                      }
                    >
                      <span className="az-row-main">
                        <span className="az-row-title">{candidate.event.title}</span>
                        <span className="az-row-value">
                          {categoryForKind(candidate.event.kind)?.label ?? candidate.event.kind} ·{' '}
                          {reasonLabel(candidate)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
                {selectedEvent != null && (
                  <button
                    type="button"
                    className="az-btn az-btn-dashed az-btn-block"
                    style={{ marginTop: '0.5rem' }}
                    onClick={() => setSelectedEventId(null)}
                  >
                    Not this one — I’ll describe it
                  </button>
                )}
              </>
            )}
          </div>
        )}

        <textarea
          className="az-textarea"
          value={note}
          onChange={(inputEvent) => setNote(inputEvent.target.value)}
          placeholder={needsDescription ? 'What did you see that night?' : 'Anything to add? (optional)'}
          rows={4}
          required={needsDescription}
        />

        <button type="submit" className="az-btn az-btn-primary az-btn-block" disabled={!canSubmit}>
          {photoPreparing
            ? 'Preparing photo…'
            : saving
              ? 'Saving…'
              : selectedEvent
                ? 'Check in to this night'
                : 'Send for review'}
        </button>
      </form>
    </Sheet>
  )
}
