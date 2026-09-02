import { useEffect, useMemo, useState } from 'react'
import { MobileIcon, type MobileIconName } from './MobileIcon'
import { Starfield } from './Starfield'
import { EntryDetailView, type EntryDetailActions, type QuickActionOutcome } from '../../views/mobile/EntryDetailView'
import { getEventsInRange, pullSkyEvents } from '../../lib/sync'
import { isVisibleLocalEvent, diversifyEvents } from '../../lib/eventFilters'
import { buildDailySkyGuideEvents, SKY_GUIDE_WINDOW_DAYS } from '../../lib/visiblePlanets'
import { categoryForKind } from '../../lib/eventCategories'
import { CELESTIAL_CATALOG } from '../../data/celestialCatalog'
import { MESSIER_OBJECTS } from '../../data/messierCatalog'
import { CITIES, cityLabel, type City } from '../../lib/cities'
import { buildEventDetail, detailInputFromEvent, type EntryDetailSubject } from '../../lib/entryDetail'
import { getDarknessWindow } from '../../lib/darknessWindow'
import { tonightWindowForTimeZone } from '../../lib/timeZone'
import { addToWatchlist, getWatchlist, isWatching, removeFromWatchlist } from '../../lib/watchlist'
import { db } from '../../lib/db'
import { useAuth } from '../../lib/auth'
import { useThemeState } from '../../lib/theme'
import { trackEvent } from '../../lib/analytics'
import { CAMERA_PROFILES, getDefaultDevice } from '../../lib/cameraProfiles'
import type { CurrentLocation } from '../../lib/currentLocation'
import type { ObservationDraft } from '../../lib/observationDraft'
import type { ObservationLogEntry, SkyEvent } from '../../lib/db'

const LOCAL_USER_ID = 'local'
const SCOPES = ['all', 'events', 'targets', 'places', 'journal'] as const
type Scope = (typeof SCOPES)[number]
const SCOPE_LABEL: Record<Scope, string> = { all: 'Everything', events: 'Events', targets: 'Targets', places: 'Places', journal: 'Journal' }

export function SearchOverlay({
  city,
  onClose,
  onNavigateToJournal,
  onLogAttempt,
}: {
  city: CurrentLocation
  onClose: () => void
  onNavigateToJournal: () => void
  onLogAttempt: (draft: ObservationDraft) => void
}) {
  const [theme] = useThemeState()
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<Scope>('all')
  const [events, setEvents] = useState<SkyEvent[]>([])
  const [journalEntries, setJournalEntries] = useState<ObservationLogEntry[]>([])
  const [entryDetail, setEntryDetail] = useState<{ subject: EntryDetailSubject; actions: EntryDetailActions } | null>(null)
  const [standoutCity, setStandoutCity] = useState<City | null>(null)
  const [standoutEvents, setStandoutEvents] = useState<SkyEvent[] | null>(null)
  const hasPremium = Boolean(user?.entitled)

  useEffect(() => {
    let cancelled = false
    async function load() {
      await pullSkyEvents()
      const now = new Date()
      const end = new Date(now.getTime() + 30 * 86_400_000)
      const [upcoming, entries] = await Promise.all([
        getEventsInRange(now, end),
        db.observations.where('userId').equals(user?.id ?? LOCAL_USER_ID).reverse().sortBy('observedAt'),
      ])
      if (cancelled) return
      setEvents(upcoming.filter((e) => isVisibleLocalEvent(e, city.lat, city.lon)))
      setJournalEntries(entries)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [city.lat, city.lon, user?.id])

  const q = query.trim().toLowerCase()

  const eventMatches = useMemo(() => (q ? events.filter((e) => e.title.toLowerCase().includes(q)) : events.slice(0, 6)), [events, q])
  const targetMatches = useMemo(() => {
    const catalog = [
      ...CELESTIAL_CATALOG.map((t) => ({ id: t.id, name: t.name, sub: `${t.kind} · ${t.difficulty}${t.magnitude != null ? ` · mag ${t.magnitude}` : ''}` })),
      ...MESSIER_OBJECTS.slice(0, 40).map((t) => ({ id: t.id, name: t.name, sub: `${t.type} · mag ${t.magnitude.toFixed(1)}` })),
    ]
    const pool = q ? catalog.filter((t) => t.name.toLowerCase().includes(q)) : catalog.slice(0, 6)
    return pool.slice(0, 12)
  }, [q])
  const placeMatches = useMemo(() => (q ? CITIES.filter((c) => c.name.toLowerCase().includes(q)) : CITIES.slice(0, 6)), [q])
  const journalMatches = useMemo(
    () => (q ? journalEntries.filter((e) => (e.targetName ?? '').toLowerCase().includes(q) || (e.note ?? '').toLowerCase().includes(q)) : journalEntries.slice(0, 6)),
    [journalEntries, q],
  )

  async function toggleWatch(event: SkyEvent): Promise<QuickActionOutcome> {
    if (!hasPremium) {
      trackEvent('Blocked free plan add', { action: 'watch', source: 'mobile_search' })
      return { watching: false, message: 'Sky Pass is required to add events to a plan. Browsing and check-ins stay free.' }
    }
    const watchlist = await getWatchlist()
    const nowWatching = !isWatching(watchlist, 'target', event.target)
    if (nowWatching) await addToWatchlist('target', event.target)
    else await removeFromWatchlist('target', event.target)
    return { watching: nowWatching, message: nowWatching ? 'Added to your watchlist.' : 'Removed from your watchlist.' }
  }

  async function selectEvent(event: SkyEvent) {
    const { start, end } = tonightWindowForTimeZone(new Date(event.startsAt), city.timeZone)
    const darknessWindow = getDarknessWindow(city.lat, city.lon, start, end)
    const subject = buildEventDetail(detailInputFromEvent(event, city, darknessWindow), null)
    const watchlist = await getWatchlist()
    setEntryDetail({
      subject,
      actions: { watching: isWatching(watchlist, 'target', event.target), onToggleWatch: () => toggleWatch(event) },
    })
  }

  function logEntryDetailAttempt() {
    if (!entryDetail) return
    const { subject } = entryDetail
    onLogAttempt({
      eventId: subject.id,
      targetName: subject.title,
      deviceUsed: CAMERA_PROFILES[getDefaultDevice()].name,
      cameraRecipeUsed: subject.recipeKey ?? undefined,
      locationLabel: city.name,
      moonIlluminationPct: subject.moonPct ?? undefined,
      directionLabel: subject.direction?.compassLabel,
    })
    setEntryDetail(null)
    onNavigateToJournal()
  }

  async function openStandout(place: City) {
    if (!hasPremium) {
      setStandoutCity(place)
      setStandoutEvents(null)
      return
    }
    setStandoutCity(place)
    await pullSkyEvents()
    const now = new Date()
    const end = new Date(now.getTime() + 14 * 86_400_000)
    const upcoming = await getEventsInRange(now, end)
    const local = upcoming.filter((e) => isVisibleLocalEvent(e, place.lat, place.lon))
    const guides = buildDailySkyGuideEvents(now, Math.min(14, SKY_GUIDE_WINDOW_DAYS), place.lat, place.lon)
    setStandoutEvents(diversifyEvents([...guides, ...local], 8))
  }

  return (
    <div className="az-overlay" style={{ zIndex: 45 }}>
      <div className="az-overlay-bg">
        <Starfield dark={theme === 'dark'} />
      </div>
      <div className="az-overlay-header" style={{ borderBottom: '1px solid var(--line)', paddingBottom: '0.75rem' }}>
        <span className="az-search-field">
          <span style={{ opacity: 0.4 }}>
            <MobileIcon name="search" />
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            placeholder="Events, targets, places, entries"
            autoFocus
          />
        </span>
        <button type="button" className="az-text-btn" onClick={onClose}>
          Cancel
        </button>
      </div>
      <div className="az-overlay-body">
        {standoutCity ? (
          <>
            <button type="button" className="az-back-btn" onClick={() => setStandoutCity(null)}>
              <MobileIcon name="back" size={16} />
              Places
            </button>
            <h2 style={{ fontFamily: 'var(--az-font-display)', fontSize: '1.375rem', margin: '0.75rem 0 0.25rem' }}>Standout in {place(standoutCity)}</h2>
            {!hasPremium ? (
              <p className="az-muted" style={{ fontSize: '0.8125rem' }}>Sky Pass unlocks browsing events in other locations.</p>
            ) : !standoutEvents ? (
              <p className="az-muted" style={{ fontSize: '0.8125rem' }}>Loading…</p>
            ) : (
              <div className="az-row-group" style={{ marginTop: '0.75rem' }}>
                {standoutEvents.map((event) => (
                  <button type="button" key={event.id} className="az-row" onClick={() => selectEvent(event)}>
                    <span className="az-row-icon">
                      <MobileIcon name={(categoryForKind(event.kind)?.icon as MobileIconName) ?? 'zap'} />
                    </span>
                    <span className="az-row-main">
                      <span className="az-row-kind">{categoryForKind(event.kind)?.label.toUpperCase() ?? event.kind}</span>
                      <span className="az-row-title">{event.title}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="az-chip-row" style={{ flexWrap: 'wrap' }}>
              {SCOPES.map((s) => (
                <button type="button" key={s} className={`az-chip${scope === s ? ' is-active' : ''}`} onClick={() => setScope(s)}>
                  {SCOPE_LABEL[s]}
                </button>
              ))}
            </div>

            {(scope === 'all' || scope === 'events') && eventMatches.length > 0 && (
              <ResultGroup title="Events">
                {eventMatches.map((event) => (
                  <button type="button" key={event.id} className="az-row" onClick={() => selectEvent(event)}>
                    <span className="az-row-icon">
                      <MobileIcon name={(categoryForKind(event.kind)?.icon as MobileIconName) ?? 'zap'} size={15} />
                    </span>
                    <span className="az-row-main">
                      <span className="az-row-title">{event.title}</span>
                      <span className="az-muted" style={{ fontSize: '0.71875rem' }}>
                        {new Date(event.startsAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                      </span>
                    </span>
                  </button>
                ))}
              </ResultGroup>
            )}

            {(scope === 'all' || scope === 'targets') && targetMatches.length > 0 && (
              <ResultGroup title="Targets">
                {targetMatches.map((t) => (
                  <div key={t.id} className="az-row" style={{ cursor: 'default' }}>
                    <span className="az-row-icon">
                      <MobileIcon name="telescope" size={15} />
                    </span>
                    <span className="az-row-main">
                      <span className="az-row-title">{t.name}</span>
                      <span className="az-muted" style={{ fontSize: '0.71875rem' }}>{t.sub}</span>
                    </span>
                  </div>
                ))}
              </ResultGroup>
            )}

            {(scope === 'all' || scope === 'places') && placeMatches.length > 0 && (
              <ResultGroup title="Places">
                {placeMatches.map((c) => (
                  <button type="button" key={c.name} className="az-row" onClick={() => openStandout(c)}>
                    <span className="az-row-icon">
                      <MobileIcon name="pin" size={15} />
                    </span>
                    <span className="az-row-main">
                      <span className="az-row-title">{cityLabel(c)}</span>
                      <span className="az-muted" style={{ fontSize: '0.71875rem' }}>{hasPremium ? 'Standout events' : 'Sky Pass to browse'}</span>
                    </span>
                  </button>
                ))}
              </ResultGroup>
            )}

            {(scope === 'all' || scope === 'journal') && journalMatches.length > 0 && (
              <ResultGroup title="Your journal">
                {journalMatches.map((entry) => (
                  <button type="button" key={entry.id} className="az-row" onClick={onNavigateToJournal}>
                    <span className="az-row-icon">
                      <MobileIcon name="journal" size={15} />
                    </span>
                    <span className="az-row-main">
                      <span className="az-row-title">{entry.targetName ?? entry.note ?? 'Journal entry'}</span>
                      <span className="az-muted" style={{ fontSize: '0.71875rem' }}>
                        {new Date(entry.observedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                        {entry.locationLabel ? ` · ${entry.locationLabel}` : ''}
                      </span>
                    </span>
                  </button>
                ))}
              </ResultGroup>
            )}
          </>
        )}
      </div>

      {entryDetail && (
        <EntryDetailView
          subject={entryDetail.subject}
          actions={entryDetail.actions}
          onClose={() => setEntryDetail(null)}
          onLogAttempt={logEntryDetailAttempt}
          dark={theme === 'dark'}
        />
      )}
    </div>
  )
}

function place(city: City) {
  return city.name
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: '1.25rem' }}>
      <span className="az-kicker" style={{ display: 'block', marginBottom: '0.5rem' }}>
        {title}
      </span>
      <div className="az-row-group">{children}</div>
    </div>
  )
}
