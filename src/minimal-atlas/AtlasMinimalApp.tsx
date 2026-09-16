import { useMemo, useState } from 'react'
import './tokens.css'
import './kit.css'
import { CATS, dayInfo, EVENTS, JOURNAL } from './data'
import { Header } from './Header'
import { LocationSheet, NavDrawer } from './Overlays'
import { DetailScreen, EventsScreen, FocusScreen, groupByDay, JournalScreen, YouScreen } from './Screens'
import type { DecoratedEvent, FilterKey } from './Screens'
import { Starfield } from './Starfield'

type Screen = 'focus' | 'events' | 'journal' | 'you' | 'detail'
type Theme = 'dark' | 'light'

export function AtlasMinimalApp() {
  const [screen, setScreen] = useState<Screen>('focus')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [navOpen, setNavOpen] = useState(false)
  const [locOpen, setLocOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>('dark')
  const [eventsTab, setEventsTab] = useState<'list' | 'calendar'>('list')
  const [city, setCity] = useState('London')
  const [toast, setToast] = useState('')
  const [watching, setWatching] = useState<Record<string, boolean>>({ 'iss-16': true, 'm31-17': true })
  const [logged, setLogged] = useState<Record<string, boolean>>({})

  const dark = theme === 'dark'

  const allDecorated: DecoratedEvent[] = useMemo(
    () =>
      EVENTS.map((ev) => {
        const info = dayInfo(ev.day)
        return {
          ...ev,
          watching: !!watching[ev.id],
          dayLabel: info.label,
          dayDate: info.date,
          metaLine: ev.time === '—' ? `${ev.cat} · reference` : `${ev.cat} · ${ev.time}`,
        }
      }),
    [watching],
  )

  const watchCount = allDecorated.filter((e) => e.watching).length
  const weekCount = allDecorated.filter((e) => e.day <= 6).length

  const filterDefs: Record<FilterKey, (e: DecoratedEvent) => boolean> = {
    all: () => true,
    tonight: (e) => e.day === 0,
    week: (e) => e.day <= 6,
    watching: (e) => e.watching,
  }
  const counts: Record<FilterKey, number> = {
    all: allDecorated.filter(filterDefs.all).length,
    tonight: allDecorated.filter(filterDefs.tonight).length,
    week: allDecorated.filter(filterDefs.week).length,
    watching: allDecorated.filter(filterDefs.watching).length,
  }
  const shown = allDecorated.filter(filterDefs[filter])
  const groups = useMemo(() => groupByDay(shown), [shown])
  const allGroups = useMemo(() => groupByDay(allDecorated), [allDecorated])

  const rowPad = '13px'

  const detailEvent = allDecorated.find((e) => e.id === detailId) ?? null

  const calFirst = new Date(2026, 8, 1).getDay()
  const eventDays = new Set(EVENTS.filter((e) => dayInfo(e.day).month === 8).map((e) => dayInfo(e.day).dayOfMonth))
  const calendar: Array<{ label: string; bg: string; fg: string; dot: number }> = []
  for (let i = 0; i < calFirst; i++) calendar.push({ label: '', bg: 'transparent', fg: 'transparent', dot: 0 })
  for (let d = 1; d <= 30; d++) {
    const isToday = d === 16
    calendar.push({
      label: String(d),
      bg: isToday ? 'var(--ak-ink)' : eventDays.has(d) ? 'var(--ak-overlay)' : 'transparent',
      fg: isToday ? 'var(--ak-bg)' : 'var(--ak-ink)',
      dot: !isToday && eventDays.has(d) ? 1 : 0,
    })
  }

  const navCounts: Record<string, number | string> = {
    focus: weekCount,
    events: allDecorated.length,
    journal: JOURNAL.length,
    you: '',
  }
  for (const c of CATS) navCounts[c.id] = EVENTS.filter((e) => e.catId === c.id).length

  const goScreen = (key: string) => {
    setScreen(key as Screen)
    setDetailId(null)
    setNavOpen(false)
  }

  const openDetail = (id: string) => {
    setScreen('detail')
    setDetailId(id)
    setToast('')
  }

  const toggleWatch = (id: string) => setWatching((w) => ({ ...w, [id]: !w[id] }))

  const toggleDetailWatch = () => {
    if (!detailEvent) return
    const on = !watching[detailEvent.id]
    setWatching((w) => ({ ...w, [detailEvent.id]: on }))
    setToast(on ? 'Watching. Atlas will flag good windows for this one.' : 'Removed from your watchlist.')
  }

  const logAttempt = () => {
    if (!detailEvent) return
    setLogged((l) => ({ ...l, [detailEvent.id]: true }))
    setToast('Logged to your journal as an attempt.')
  }

  return (
    <div
      className="atlas-minimal"
      data-theme={dark ? 'dark' : 'light'}
      style={{
        position: 'relative',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--ak-bg)',
        color: 'var(--ak-ink)',
        fontFamily: 'var(--ak-font-sans)',
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      <Starfield dark={dark} />

      <Header
        screen={screen}
        detailCat={detailEvent?.cat ?? ''}
        dark={dark}
        onBack={() => {
          setScreen('focus')
          setDetailId(null)
          setToast('')
        }}
        onOpenNav={() => setNavOpen(true)}
        onToggleTheme={() => setTheme(dark ? 'light' : 'dark')}
      />

      <div className="mx-scroll" style={{ position: 'relative', zIndex: 1, flex: 1, minHeight: 0, padding: '0 16px 48px' }}>
        {screen === 'focus' && (
          <FocusScreen
            city={city}
            filter={filter}
            counts={counts}
            weekCount={weekCount}
            groups={groups}
            empty={shown.length === 0}
            emptyNote={filter === 'watching' ? 'Tap the shield on any row to start watching it.' : 'Try a wider window.'}
            rowPad={rowPad}
            onPickFilter={setFilter}
            onOpen={openDetail}
            onToggleWatch={toggleWatch}
          />
        )}

        {screen === 'events' && (
          <EventsScreen
            tab={eventsTab}
            onSetTab={setEventsTab}
            monthLabel="September 2026"
            city={city}
            calendar={calendar}
            allGroups={allGroups}
            rowPad={rowPad}
            onOpen={openDetail}
          />
        )}

        {screen === 'journal' && <JournalScreen />}

        {screen === 'you' && (
          <YouScreen
            city={city}
            watchCount={watchCount}
            journalCount={JOURNAL.length}
            dark={dark}
            onOpenLocation={() => setLocOpen(true)}
            onGoWatching={() => {
              setScreen('focus')
              setFilter('watching')
            }}
            onToggleTheme={() => setTheme(dark ? 'light' : 'dark')}
          />
        )}

        {screen === 'detail' && detailEvent && (
          <DetailScreen
            event={detailEvent}
            city={city}
            watching={!!watching[detailEvent.id]}
            logged={!!logged[detailEvent.id]}
            toast={toast}
            onToggleWatch={toggleDetailWatch}
            onLogAttempt={logAttempt}
          />
        )}
      </div>

      <NavDrawer
        open={navOpen}
        screen={screen}
        city={city}
        counts={navCounts}
        showRail
        onClose={() => setNavOpen(false)}
        onGo={goScreen}
        onOpenLocation={() => {
          setLocOpen(true)
          setNavOpen(false)
        }}
        onPickCategory={() => {
          setScreen('events')
          setEventsTab('list')
          setNavOpen(false)
        }}
      />

      <LocationSheet
        open={locOpen}
        city={city}
        onClose={() => setLocOpen(false)}
        onPick={(name) => {
          setCity(name)
          setLocOpen(false)
        }}
      />
    </div>
  )
}
