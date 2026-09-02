import { useEffect, useMemo, useState } from 'react'
import { MobileIcon, type MobileIconName } from '../components/mobile/MobileIcon'
import { EntryDetailView, type EntryDetailActions, type QuickActionOutcome } from '../views/mobile/EntryDetailView'
import { CAMERA_PROFILES, getDefaultDevice } from '../lib/cameraProfiles'
import { EVENT_CATEGORIES, categoryForKind } from '../lib/eventCategories'
import { isVisibleLocalEvent } from '../lib/eventFilters'
import { addGetReadyReminder, ensureNotificationPermission, listGetReadyReminders } from '../lib/getReadyReminders'
import { getEventsInRange, pullSkyEvents } from '../lib/sync'
import { addToWatchlist, getWatchlist, isWatching, removeFromWatchlist, type WatchlistItem } from '../lib/watchlist'
import { getTaggedEventIds, toggleEventTag } from '../lib/eventTags'
import { trackEvent } from '../lib/analytics'
import { useAuth } from '../lib/auth'
import { buildEventDetail, detailInputFromEvent, type EntryDetailSubject } from '../lib/entryDetail'
import { metaFor } from '../lib/tonightTargets'
import { getDarknessWindow } from '../lib/darknessWindow'
import { tonightWindowForTimeZone } from '../lib/timeZone'
import { eventLookaheadDays } from '../lib/entitlementLimits'
import { fetchViewingForecast, localDateKey } from '../lib/weather'
import { ensurePushSubscription, queueWatchConfirmation } from '../lib/push'
import { useThemeState } from '../lib/theme'
import type { CurrentLocation } from '../lib/currentLocation'
import type { ObservationDraft } from '../lib/observationDraft'
import type { SkyEvent } from '../lib/db'

export interface EventsPageProps {
  city: CurrentLocation
  onLogAttempt: (draft: ObservationDraft) => void
}

const INSTRUMENTS: Array<{ id: 'eye' | 'binoculars' | 'telescope'; label: string; icon: MobileIconName }> = [
  { id: 'eye', label: 'Naked eye', icon: 'eye' },
  { id: 'binoculars', label: 'Binoculars', icon: 'binoculars' },
  { id: 'telescope', label: 'Telescope', icon: 'telescope' },
]

function dayGroupLabel(dateKey: string, todayKey: string, timeZone?: string) {
  if (dateKey === todayKey) return 'Today'
  const date = new Date(dateKey + 'T12:00:00')
  const tomorrow = new Date(todayKey + 'T12:00:00')
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (localDateKey(date.toISOString(), timeZone) === localDateKey(tomorrow.toISOString(), timeZone)) return 'Tomorrow'
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export function EventsPage({ city, onLogAttempt }: EventsPageProps) {
  const [theme] = useThemeState()
  const [events, setEvents] = useState<SkyEvent[] | null>(null)
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [taggedIds, setTaggedIds] = useState<Set<string>>(new Set())
  const [reminders, setReminders] = useState(() => listGetReadyReminders())
  const [category, setCategory] = useState('all')
  const [instrument, setInstrument] = useState<'eye' | 'binoculars' | 'telescope'>('eye')
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [entryDetail, setEntryDetail] = useState<{ subject: EntryDetailSubject; actions: EntryDetailActions } | null>(null)
  const { user } = useAuth()
  const hasPremium = Boolean(user?.entitled)
  const lookaheadDays = eventLookaheadDays(hasPremium)

  useEffect(() => {
    let cancelled = false
    async function load() {
      await pullSkyEvents()
      const now = new Date()
      const end = new Date(now.getTime() + lookaheadDays * 86_400_000)
      const [upcoming, watched, tagged] = await Promise.all([getEventsInRange(now, end), getWatchlist(), getTaggedEventIds()])
      if (cancelled) return
      setEvents(upcoming.filter((event) => isVisibleLocalEvent(event, city.lat, city.lon)))
      setWatchlist(watched)
      setTaggedIds(tagged)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [city.lat, city.lon, lookaheadDays])

  useEffect(() => {
    function refreshTags() {
      getTaggedEventIds().then(setTaggedIds)
    }
    window.addEventListener('atlas:tagged-events-changed', refreshTags)
    return () => window.removeEventListener('atlas:tagged-events-changed', refreshTags)
  }, [])

  const filtered = useMemo(() => {
    if (!events) return []
    if (category === 'all') return events
    return events.filter((e) => categoryForKind(e.kind)?.id === category)
  }, [events, category])

  const groups = useMemo(() => {
    if (!filtered.length) return []
    const todayKey = localDateKey(new Date().toISOString(), city.timeZone)
    const byDay = new Map<string, SkyEvent[]>()
    for (const event of filtered) {
      const key = localDateKey(event.startsAt, city.timeZone)
      if (!byDay.has(key)) byDay.set(key, [])
      byDay.get(key)!.push(event)
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, dayEvents]) => ({ key, label: dayGroupLabel(key, todayKey, city.timeZone), events: dayEvents }))
  }, [filtered, city.timeZone])

  const instrumentNote = useMemo(() => {
    if (!events) return ''
    const todayKey = localDateKey(new Date().toISOString(), city.timeZone)
    const tonight = events.filter((e) => localDateKey(e.startsAt, city.timeZone) === todayKey)
    const reachable = tonight.filter((e) => {
      const meta = metaFor(e.kind)
      if (instrument === 'eye') return meta.nakedEyeVisible
      if (instrument === 'binoculars') return meta.nakedEyeVisible || meta.phoneFriendly
      return true
    })
    const label = INSTRUMENTS.find((i) => i.id === instrument)?.label ?? ''
    return `${label} · ${reachable.length} target${reachable.length === 1 ? '' : 's'} reachable tonight from ${city.name}.`
  }, [events, instrument, city.timeZone, city.name])

  const calendarDays = useMemo(() => {
    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const firstWeekday = new Date(year, month, 1).getDay()
    const eventDates = new Set((events ?? []).map((e) => localDateKey(e.startsAt, city.timeZone)))
    const todayKey = localDateKey(today.toISOString(), city.timeZone)
    const leadingBlanks = Array.from({ length: firstWeekday }, () => null)
    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      return { day, key, hasEvent: eventDates.has(key), isToday: key === todayKey }
    })
    return { leadingBlanks, days, monthLabel: today.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) }
  }, [events, city.timeZone])

  async function toggleWatch(event: SkyEvent): Promise<QuickActionOutcome> {
    if (!hasPremium) {
      trackEvent('Blocked free plan add', { action: 'watch', source: 'mobile_events' })
      return { watching: false, message: 'Sky Pass is required to add events to a plan. Browsing and check-ins stay free.' }
    }
    const nowWatching = !isWatching(watchlist, 'target', event.target)
    if (nowWatching) {
      await addToWatchlist('target', event.target)
      let pushMessage = ''
      try {
        const pushReady = await ensurePushSubscription()
        const confirmed = pushReady ? await queueWatchConfirmation({ id: event.id, title: event.title }) : false
        pushMessage = confirmed
          ? 'Watching. A confirmation notification is queued.'
          : pushReady
            ? 'Watching. Atlas will notify you about good viewing windows.'
            : 'Watching saved, but push is not enabled. Enable it in Profile to receive notifications.'
      } catch {
        pushMessage = 'Watching saved, but push setup needs attention in Profile.'
      }
      setWatchlist(await getWatchlist())
      return { watching: nowWatching, message: pushMessage }
    }
    await removeFromWatchlist('target', event.target)
    setWatchlist(await getWatchlist())
    return { watching: nowWatching, message: nowWatching ? 'Added to your watchlist.' : 'Removed from your watchlist.' }
  }

  async function toggleTag(event: SkyEvent): Promise<QuickActionOutcome> {
    const nowTagged = !taggedIds.has(event.id)
    await toggleEventTag(event.id, !nowTagged)
    if (nowTagged) await addReminder(event)
    setTaggedIds(await getTaggedEventIds())
    return { tagged: nowTagged, message: nowTagged ? 'Tagged — added to your feed filter and armed a reminder.' : 'Untagged.' }
  }

  async function addReminder(event: SkyEvent): Promise<QuickActionOutcome> {
    const hasPermission = await ensureNotificationPermission()
    let cloudCoverPct: number | undefined
    let precipitationChancePct: number | undefined
    try {
      const forecast = await fetchViewingForecast(city.lat, city.lon, 7)
      const day = forecast.days.find((item) => item.date === localDateKey(event.startsAt, forecast.timeZone))
      if (day) {
        cloudCoverPct = day.cloudCoverPct
        precipitationChancePct = day.precipitationChancePct
      }
    } catch {
      // Arm the reminder without a weather snapshot; the fire-time check
      // in getReadyReminders re-fetches live conditions anyway.
    }
    await addGetReadyReminder({
      eventId: event.id,
      title: event.title,
      kind: event.kind,
      target: event.target,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      deviceName: CAMERA_PROFILES[getDefaultDevice()].name,
      lat: city.lat,
      lon: city.lon,
      cloudCoverPct,
      precipitationChancePct,
    })
    setReminders(listGetReadyReminders())
    const message = hasPermission ? 'Reminder armed.' : 'Saved in Atlas. Browser notifications are not enabled.'
    trackEvent('Added get ready reminder', { target: event.title, hasPermission, source: 'mobile_events' })
    return { reminderActive: true, message }
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
  }

  function selectEvent(event: SkyEvent) {
    const { start, end } = tonightWindowForTimeZone(new Date(event.startsAt), city.timeZone)
    const darknessWindow = getDarknessWindow(city.lat, city.lon, start, end)
    const subject = buildEventDetail(detailInputFromEvent(event, city, darknessWindow), null)
    const reminder = reminders.find((r) => r.eventId === event.id)
    setEntryDetail({
      subject,
      actions: {
        watching: isWatching(watchlist, 'target', event.target),
        onToggleWatch: () => toggleWatch(event),
        reminderActive: !!reminder,
        onRemind: () => addReminder(event),
        tagged: taggedIds.has(event.id),
        onToggleTag: () => toggleTag(event),
      },
    })
  }

  return (
    <div className="az-page">
      <h1 className="az-h1">Events</h1>
      <p className="az-hero-title">
        {events ? `${events.length} upcoming` : '—'} · next {lookaheadDays} days
      </p>

      <div className="az-chip-row" style={{ marginTop: '0.875rem' }}>
        {INSTRUMENTS.map((opt) => (
          <button
            type="button"
            key={opt.id}
            className={`az-chip${instrument === opt.id ? ' is-active' : ''}`}
            onClick={() => setInstrument(opt.id)}
          >
            <MobileIcon name={opt.icon} size={15} />
            {opt.label}
          </button>
        ))}
      </div>
      <p className="az-muted" style={{ margin: '0.5rem 0 0', fontSize: '0.75rem' }}>
        {instrumentNote}
      </p>

      <div className="az-chip-row" style={{ marginTop: '0.875rem' }}>
        <button type="button" className={`az-chip${category === 'all' ? ' is-active' : ''}`} onClick={() => setCategory('all')}>
          All
          <span className="az-chip-count">{events?.length ?? 0}</span>
        </button>
        {EVENT_CATEGORIES.map((c) => (
          <button type="button" key={c.id} className={`az-chip${category === c.id ? ' is-active' : ''}`} onClick={() => setCategory(c.id)}>
            <MobileIcon name={c.icon as MobileIconName} size={14} />
            {c.label}
            <span className="az-chip-count">{events?.filter((e) => categoryForKind(e.kind)?.id === c.id).length ?? 0}</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem' }}>
        <div className="az-seg">
          <button type="button" className={`az-seg-btn${view === 'list' ? ' is-active' : ''}`} onClick={() => setView('list')}>
            List
          </button>
          <button type="button" className={`az-seg-btn${view === 'calendar' ? ' is-active' : ''}`} onClick={() => setView('calendar')}>
            Calendar
          </button>
        </div>
        <span className="az-kicker">{filtered.length} SHOWN</span>
      </div>

      {view === 'calendar' && (
        <div className="az-calendar">
          <div className="az-calendar-head">
            <strong>{calendarDays.monthLabel}</strong>
            <span className="az-kicker">{city.name.toUpperCase()}</span>
          </div>
          <div className="az-calendar-grid">
            {calendarDays.leadingBlanks.map((_, i) => (
              <div key={`b${i}`} className="az-calendar-cell is-empty" />
            ))}
            {calendarDays.days.map((d) => (
              <div key={d.key} className={`az-calendar-cell${d.hasEvent ? ' has-event' : ''}${d.isToday ? ' is-today' : ''}`}>
                {d.day}
                {d.hasEvent && !d.isToday && <span className="az-cal-dot" style={{ background: 'var(--az-violet)' }} />}
              </div>
            ))}
          </div>
          <div className="az-calendar-legend">
            <span>
              <i style={{ background: 'var(--az-violet)' }} />
              EVENT
            </span>
          </div>
        </div>
      )}

      {view === 'list' &&
        groups.map((group) => (
          <div key={group.key} style={{ marginTop: '1.125rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
              <span className="az-kicker">{group.label}</span>
              <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
            </div>
            <div className="az-row-group">
              {group.events.map((event) => (
                <button type="button" key={event.id} className="az-row" onClick={() => selectEvent(event)}>
                  <span className="az-row-icon">
                    <MobileIcon name={(categoryForKind(event.kind)?.icon as MobileIconName) ?? 'zap'} />
                  </span>
                  <span className="az-row-main">
                    <span className="az-row-kind">{categoryForKind(event.kind)?.label.toUpperCase() ?? event.kind}</span>
                    <span className="az-row-title">{event.title}</span>
                  </span>
                  <span className="az-row-trail">
                    <span className="az-row-time">{new Date(event.startsAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                  </span>
                  <span className="az-row-chevron">
                    <MobileIcon name="chevron" size={14} />
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}

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
