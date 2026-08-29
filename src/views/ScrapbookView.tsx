import { useEffect, useState } from 'react'
import { db, type AttemptRating, type ObservationLogEntry, type SkyEvent } from '../lib/db'
import { getEventsForDate, pullObservations, pullSkyEvents, pushObservation } from '../lib/sync'
import { recordWeeklyActivity } from '../lib/streaks'
import { createDiscovery } from '../lib/discoveries'
import { shareObservation } from '../lib/sharing'
import { getScrapbookPrompt } from '../lib/scrapbookPrompt'
import { useAuth } from '../lib/auth'
import { ObservationCard } from '../components/ObservationCard'
import { EventObservationThread } from '../components/EventObservationThread'
import { PostShareDialog } from '../components/PostShareDialog'
import { LocationSearchInput } from '../components/LocationSearchInput'
import { trackEvent } from '../lib/analytics'
import type { ObservationDraft } from '../lib/observationDraft'
import { downloadObservationsCsv } from '../lib/observationExport'
import { cityStampsFromObservations, pushCityStampFromObservation, shareCityStamp } from '../lib/cityStamps'
import { requestPhotoCaption } from '../lib/photoCaption'
import { suggestObservationCaption } from '../lib/observationCaptionSuggestion'
import { cityLabel, type City } from '../lib/cities'
import { isVisibleLocalEvent } from '../lib/eventFilters'
import type { CurrentLocation } from '../lib/currentLocation'
import { isAtlasMediaEnabled } from '../lib/atlasMedia'
import { optimizeObservationPhoto, PhotoOptimizationError } from '../lib/photoOptimization'

// Entries made while signed out are scoped to this fixed local id so the
// Scrapbook still works fully offline-first with no account. Once signed
// in, new entries are scoped to the real user id. Entries logged before
// signing in are folded into the account on signup by the signup-wall
// modal below (STS-322's mergeLocalDataIntoAccount).
const LOCAL_USER_ID = 'local'

const RATING_OPTIONS: AttemptRating[] = ['poor', 'ok', 'good', 'great']
const RATING_LABEL: Record<AttemptRating, string> = {
  poor: 'Poor',
  ok: 'OK',
  good: 'Good',
  great: 'Great',
}

interface ScrapbookViewProps {
  draft: ObservationDraft | null
  onDraftConsumed: () => void
  currentLocation: CurrentLocation
}

function localDateInputValue(date = new Date()): string {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function observedAtForDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  const now = new Date()
  return new Date(year, month - 1, day, now.getHours(), now.getMinutes()).toISOString()
}

export function ScrapbookView({ draft, onDraftConsumed, currentLocation }: ScrapbookViewProps) {
  const { user } = useAuth()
  const scopeId = user?.id ?? LOCAL_USER_ID
  const [entries, setEntries] = useState<ObservationLogEntry[]>([])
  const [note, setNote] = useState('')
  const [prompt, setPrompt] = useState('What did you see tonight?')
  const [rating, setRating] = useState<AttemptRating | null>(null)
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreparing, setPhotoPreparing] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [stampShareStatus, setStampShareStatus] = useState<{ cityName: string; message: string } | null>(null)
  const [captionIsSuggested, setCaptionIsSuggested] = useState(false)
  // Freeform entries (no draft handed off from Events/Plan) still need a
  // way to link a specific sky event -- searches the local event mirror
  // rather than requiring the user to open that event's detail page first.
  const [eventQuery, setEventQuery] = useState('')
  const [eventResults, setEventResults] = useState<SkyEvent[]>([])
  const [mentionedEvent, setMentionedEvent] = useState<SkyEvent | null>(null)
  const [backdating, setBackdating] = useState(false)
  const [checkinDate, setCheckinDate] = useState(localDateInputValue)
  const [checkinLocation, setCheckinLocation] = useState<City>(() => ({
    name: currentLocation.name,
    lat: currentLocation.lat,
    lon: currentLocation.lon,
    timeZone: currentLocation.timeZone,
  }))
  const [locationQuery, setLocationQuery] = useState(currentLocation.name)
  const [dateEvents, setDateEvents] = useState<SkyEvent[]>([])
  const [dateEventsLoading, setDateEventsLoading] = useState(false)

  async function refresh(nextScopeId = scopeId) {
    const all = await db.observations.where('userId').equals(nextScopeId).reverse().sortBy('observedAt')
    setEntries(all)
  }

  useEffect(() => {
    let cancelled = false

    void (async () => {
      // Render the browser cache immediately, then reconcile the signed-in
      // account's private PocketBase history. This makes a fresh desktop
      // install show existing check-ins instead of an empty journal.
      await refresh()
      if (scopeId === LOCAL_USER_ID) return
      await pullObservations()
      if (!cancelled) await refresh()
    })()

    return () => {
      cancelled = true
    }
  }, [scopeId])

  useEffect(() => {
    getScrapbookPrompt().then(setPrompt)
  }, [])

  // A past check-in starts at the current app location, but an explicit
  // location choice inside the Sky Pass panel must not be overwritten.
  useEffect(() => {
    if (backdating) return
    setCheckinLocation({ name: currentLocation.name, lat: currentLocation.lat, lon: currentLocation.lon, timeZone: currentLocation.timeZone })
    setLocationQuery(currentLocation.name)
  }, [backdating, currentLocation])

  // Ensures the local event mirror is populated for the "mention an event"
  // search below even when Journal is opened without visiting Events/Plan
  // first this session (pullSkyEvents dedupes concurrent/redundant calls).
  useEffect(() => {
    pullSkyEvents()
  }, [])

  // Metadata-driven starting caption -- no AI/network call, just what
  // Atlas already computed before "Log attempt" was tapped (direction,
  // moon/cloud conditions). Only offered when there's nothing typed yet,
  // and stops being tagged "Suggested" the moment the user edits it.
  useEffect(() => {
    if (!draft) return
    setNote((current) => (current.trim() ? current : suggestObservationCaption(draft)))
    setCaptionIsSuggested(true)
  }, [draft])

  function clearDraft() {
    setRating(null)
    setPhoto(null)
    setPhotoPreparing(false)
    setPhotoError(null)
    setCaptionIsSuggested(false)
    setMentionedEvent(null)
    setEventQuery('')
    setEventResults([])
    setBackdating(false)
    setCheckinDate(localDateInputValue())
    setDateEvents([])
    onDraftConsumed()
  }

  // A draft handed off from Events/Plan already names its event; a
  // freeform entry only has one if the user searched and picked one below.
  useEffect(() => {
    if (draft) {
      setMentionedEvent(null)
      setEventQuery('')
      setEventResults([])
    }
  }, [draft])

  useEffect(() => {
    if (draft) return
    const trimmed = eventQuery.trim().toLowerCase()
    if (!trimmed) {
      setEventResults([])
      return
    }
    let cancelled = false
    db.skyEvents
      .filter((event) => event.title.toLowerCase().includes(trimmed) || event.target.toLowerCase().includes(trimmed))
      .limit(8)
      .toArray()
      .then((results) => {
        if (!cancelled) setEventResults(results)
      })
    return () => {
      cancelled = true
    }
  }, [eventQuery, draft])

  useEffect(() => {
    if (!backdating || !user?.entitled) return
    let cancelled = false
    setDateEventsLoading(true)
    getEventsForDate(checkinDate)
      .then((events) => {
        if (!cancelled) setDateEvents(events.filter((event) => isVisibleLocalEvent(event, checkinLocation.lat, checkinLocation.lon)))
      })
      .finally(() => {
        if (!cancelled) setDateEventsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [backdating, checkinDate, checkinLocation.lat, checkinLocation.lon, user?.entitled])

  function mentionEvent(event: SkyEvent) {
    setMentionedEvent(event)
    setEventQuery('')
    setEventResults([])
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = note.trim()
    if (!trimmed) return

    let entryPhoto = photo
    if (photo && isAtlasMediaEnabled()) {
      setPhotoPreparing(true)
      setPhotoError(null)
      try {
        entryPhoto = await optimizeObservationPhoto(photo)
      } catch (error) {
        setPhotoError(error instanceof PhotoOptimizationError ? error.message : 'This photo could not be prepared for upload.')
        setPhotoPreparing(false)
        return
      }
      setPhotoPreparing(false)
    }

    const entry: ObservationLogEntry = {
      id: crypto.randomUUID(),
      userId: scopeId,
      observedAt: backdating ? observedAtForDate(checkinDate) : new Date().toISOString(),
      note: trimmed,
      ...(draft
        ? {
            eventId: draft.eventId,
            targetName: draft.targetName,
            deviceUsed: draft.deviceUsed,
            cameraRecipeUsed: draft.cameraRecipeUsed,
            locationLabel: draft.locationLabel,
          }
        : mentionedEvent
          ? { eventId: mentionedEvent.id, targetName: mentionedEvent.title }
          : {}),
      ...(backdating ? { locationLabel: cityLabel(checkinLocation) } : {}),
      ...(rating ? { attemptRating: rating } : {}),
      ...(entryPhoto ? { photo: entryPhoto } : {}),
    }
    await db.observations.add(entry)
    trackEvent('Logged observation', {
      hasTarget: draft != null || mentionedEvent != null,
      rating: rating ?? undefined,
      hasPhoto: entryPhoto != null,
      backdated: backdating,
    })
    setNote('')
    clearDraft()
    await refresh()
    let remoteId: string | null = null
    try {
      remoteId = await pushObservation(entry)
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'We couldn’t add this photo right now.')
    }
    await pushCityStampFromObservation(entry)
    await recordWeeklyActivity()

    // Sky Pass-only, best-effort: silently does nothing if the deployment
    // has no ANTHROPIC_API_KEY configured, the user isn't entitled, or the
    // request just fails -- see photoCaption.ts. Fired after everything
    // else so a slow/failed caption never delays the rest of the save.
    if (entry.photo && user?.entitled && remoteId) {
      requestPhotoCaption({
        photo: entry.photo,
        targetName: entry.targetName,
        observationId: entry.id,
        observationRemoteId: remoteId,
      }).then((caption) => {
        if (caption) refresh()
      })
    }
  }

  // Reuses the Discoveries feed's own post creation (src/lib/discoveries.ts)
  // -- a forwarded entry is just a discovery with no image/equipment fields,
  // same as posting straight from the Feed tab would produce.
  async function handleShare(entry: ObservationLogEntry) {
    if (!entry.note) return
    await createDiscovery({ caption: entry.note, target: entry.targetName ?? '', camera: entry.deviceUsed ?? '', telescope: '', filters: '', image: null })
    await db.observations.update(entry.id, { sharedToFeed: true })
    await refresh()
  }

  // Called after the explicit confirmation in PostShareDialog. A journal
  // post remains private until that point.
  async function createShareLink(entry: ObservationLogEntry): Promise<string> {
    const url = await shareObservation(entry)
    trackEvent('Shared public card')
    await refresh()
    return url
  }

  function handleExport() {
    downloadObservationsCsv(entries)
    trackEvent('Exported observations', { count: entries.length })
  }

  async function handleShareStamp(stamp: ReturnType<typeof cityStampsFromObservations>[number]) {
    try {
      const url = await shareCityStamp(stamp)
      await navigator.clipboard.writeText(url)
      setStampShareStatus({ cityName: stamp.cityName, message: 'Stamp link copied!' })
      trackEvent('Shared city stamp', { city: stamp.cityName })
    } catch {
      setStampShareStatus({ cityName: stamp.cityName, message: 'Sign in to share this stamp.' })
    }
  }

  const cityStamps = cityStampsFromObservations(entries)
  const eventThreads = new Map<string, { title: string; entries: ObservationLogEntry[] }>()
  const standaloneEntries: ObservationLogEntry[] = []

  for (const entry of entries) {
    if (!entry.eventId) {
      standaloneEntries.push(entry)
      continue
    }
    const thread = eventThreads.get(entry.eventId)
    if (thread) {
      thread.entries.push(entry)
    } else {
      eventThreads.set(entry.eventId, { title: entry.targetName ?? 'Linked sky event', entries: [entry] })
    }
  }

  return (
    <section className="widget-section">
      <div className="scrapbook-header">
        <h2>Scrapbook</h2>
        {entries.length > 0 && (
          <button type="button" className="scrapbook-export" onClick={handleExport}>
            Export CSV
          </button>
        )}
      </div>
      {draft && (
        <div className="scrapbook-draft-banner">
          <span>
            Logging attempt for <strong>{draft.targetName}</strong>
          </span>
          <button type="button" onClick={clearDraft}>
            Cancel
          </button>
        </div>
      )}
      <form className="scrapbook-form" onSubmit={handleSave}>
        {!draft && (
          <div className="scrapbook-event-mention">
            {mentionedEvent ? (
              <div className="scrapbook-draft-banner">
                <span>
                  Mentioning <strong>{mentionedEvent.title}</strong>
                </span>
                <button type="button" onClick={() => setMentionedEvent(null)}>
                  Remove
                </button>
              </div>
            ) : (
              <div className="scrapbook-event-search">
                <input
                  type="search"
                  value={eventQuery}
                  onChange={(event) => setEventQuery(event.target.value)}
                  placeholder="Mention an event (optional)"
                  aria-label="Mention an event"
                />
                {eventResults.length > 0 && (
                  <ul className="scrapbook-event-results" role="listbox">
                    {eventResults.map((result) => (
                      <li key={result.id}>
                        <button type="button" onClick={() => mentionEvent(result)}>
                          {result.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
        {!draft && user?.entitled && (
          <details className="scrapbook-backdate" open={backdating} onToggle={(event) => setBackdating(event.currentTarget.open)}>
            <summary>Check in for a past date <span>Sky Pass</span></summary>
            <div className="scrapbook-backdate-fields">
              <label>
                Date
                <input type="date" value={checkinDate} max={localDateInputValue()} onChange={(event) => setCheckinDate(event.target.value)} />
              </label>
              <label>
                Location
                <LocationSearchInput
                  id="scrapbook-checkin-location"
                  value={locationQuery}
                  onChange={setLocationQuery}
                  onSelect={(city) => {
                    setCheckinLocation(city)
                    setLocationQuery(cityLabel(city))
                  }}
                  placeholder="Where were you?"
                />
              </label>
            </div>
            <div className="scrapbook-date-events" aria-live="polite">
              <p>Tag an event if you like — or save this as a date-only check-in.</p>
              {dateEventsLoading && <span>Finding events for this date…</span>}
              {!dateEventsLoading && dateEvents.length > 0 && (
                <div className="scrapbook-date-event-list">
                  {dateEvents.map((result) => (
                    <button key={result.id} type="button" className={mentionedEvent?.id === result.id ? 'is-selected' : ''} onClick={() => mentionEvent(result)}>
                      {result.title}
                    </button>
                  ))}
                </div>
              )}
              {!dateEventsLoading && dateEvents.length === 0 && <span>No named Atlas event here.</span>}
            </div>
          </details>
        )}
        {captionIsSuggested && note.trim() && <p className="scrapbook-caption-hint">Suggested — edit as needed</p>}
        <textarea
          value={note}
          onChange={(event) => {
            setCaptionIsSuggested(false)
            setNote(event.target.value)
          }}
          placeholder={prompt}
          rows={3}
        />
        <div className="scrapbook-rating-picker">
          {RATING_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={rating === option ? 'is-active' : ''}
              onClick={() => setRating(rating === option ? null : option)}
            >
              {RATING_LABEL[option]}
            </button>
          ))}
        </div>
        <label className="scrapbook-photo-input" htmlFor="scrapbook-photo">
          {photo ? photo.name : 'Add a photo'}
        </label>
        <input
          id="scrapbook-photo"
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            setPhoto(event.target.files?.[0] ?? null)
            setPhotoError(null)
          }}
        />
        {isAtlasMediaEnabled() && <p className="scrapbook-photo-storage-note">Photos are optimised to a 4096px JPEG before private upload. Originals stay on your device.</p>}
        {photoError && <p className="scrapbook-photo-storage-error" role="alert">{photoError}</p>}
        <button type="submit" className="scrapbook-submit" disabled={photoPreparing}>
          {photoPreparing ? 'Preparing photo…' : 'Save observation'}
        </button>
      </form>
      {cityStamps.length > 0 && (
        <section className="city-stamps" aria-label="City check-in stamps">
          <div className="scrapbook-header">
            <h3>City stamps</h3>
            <span className="scrapbook-hint">{cityStamps.length} collected</span>
          </div>
          <div className="city-stamp-grid">
            {cityStamps.map((stamp) => (
              <div className="city-stamp" key={stamp.cityName}>
                <span>{stamp.cityName.slice(0, 3).toUpperCase()}</span>
                <strong>{stamp.cityName}</strong>
                <small>
                  {stamp.count} check-in{stamp.count === 1 ? '' : 's'} ·{' '}
                  {new Date(stamp.lastCheckedInAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </small>
                <button type="button" className="scrapbook-share-card" onClick={() => handleShareStamp(stamp)}>
                  Share stamp
                </button>
                {stampShareStatus?.cityName === stamp.cityName && <small>{stampShareStatus.message}</small>}
              </div>
            ))}
          </div>
        </section>
      )}
      {entries.length === 0 ? (
        <p>Nothing logged yet — your sky-watching notes will show up here.</p>
      ) : (
        <ul className="row-list scrapbook-observation-list">
          {[...eventThreads.entries()].map(([eventId, thread]) => (
            <EventObservationThread
              key={eventId}
              eventId={eventId}
              title={thread.title}
              entries={thread.entries}
              canShare={Boolean(user)}
              onShareToFeed={handleShare}
              onCreateShareLink={createShareLink}
            />
          ))}
          {standaloneEntries.map((entry) => (
            <li
              key={entry.id}
              className="scrapbook-entry"
            >
              <ObservationCard entry={entry} />
              <div className="scrapbook-entry-footer">
                {user && (
                  <button
                    type="button"
                    className="scrapbook-share"
                    onClick={() => handleShare(entry)}
                    disabled={entry.sharedToFeed}
                  >
                    {entry.sharedToFeed ? 'Shared to Feed' : 'Share to Feed'}
                  </button>
                )}
                {user && <PostShareDialog onCreateLink={() => createShareLink(entry)} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
