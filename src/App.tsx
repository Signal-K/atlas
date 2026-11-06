import { useEffect, useMemo, useRef, useState, lazy, Suspense, type ReactNode, type FormEvent } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Starfield } from './components/mobile/Starfield'
const FeedBriefing = lazy(() => import('./components/FeedBriefing').then(module => ({ default: module.FeedBriefing })))
import { matchesEquipment, type Equipment } from './lib/feedEquipment'
const SkillsTree = lazy(() => import('./components/SkillsTree').then(module => ({ default: module.SkillsTree })))
const ObservationHistory = lazy(() => import('./components/ObservationHistory').then(module => ({ default: module.ObservationHistory })))
const AuthForm = lazy(() => import('./components/AuthForm').then(module => ({ default: module.AuthForm })))
import { useAppLocation } from './providers/useAppLocation'
import { useAuth, signOut } from './lib/auth'
import { CITIES, cityLabel } from './lib/cities'
import { db, type ObservationLogEntry, type SkyEvent } from './lib/db'
import { getEventsInRange, pullSkyEvents, pushObservation } from './lib/sync'
import { getTaggedEventIds, toggleEventTag } from './lib/eventTags'
import { categoryForKind, EVENT_CATEGORIES, GUIDE_KIND_IDS } from './lib/eventCategories'
import { isVisibleLocalEvent } from './lib/eventFilters'
import { eventLookaheadDays } from './lib/entitlementLimits'
import { pb } from './lib/pocketbase'
import { trackEvent } from './lib/analytics'
import { DailyFocus } from './components/DailyFocus'
import { useEntitlementSync } from './providers/useEntitlementSync'

type IconName = 'feed' | 'collections' | 'calendar' | 'journal' | 'search' | 'account' | 'skills' | 'history' | 'settings'
const paths: Record<IconName, string> = {
  skills: 'M12 3v6 M5 14v6 M19 14v6 M5 14V9h14v5 M9 3h6',
  history: 'M3 11a9 9 0 1 1 3 7 M3 4v7h7 M12 7v6l4 2',
  settings: 'M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6',
  feed: 'M5 5h14v14H5z',
  collections: 'M7 4h10v6H7z M4 14h6v6H4z M14 14h6v6h-6z',
  calendar: 'M4 6h16v14H4z M8 3v6 M16 3v6 M4 11h16',
  journal: 'M4 5h7v15H4z M14 5h6v15h-6z',
  search: 'M16 16l5 5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  account: 'M20 21a8 8 0 0 0-16 0 M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
}
function Icon({ name }: { name: IconName }) {
  return <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}
function Sheet({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { ref.current?.showModal() }, [])
  return <dialog ref={ref} className="sheet" aria-label={title} onCancel={close} onClick={event => { if (event.target === event.currentTarget) close() }}><header><h2>{title}</h2><button type="button" onClick={close} aria-label="Close">×</button></header>{children}</dialog>
}
const NAV: { to: string; name: string; icon: IconName }[] = [
  { to: '/app/hub', name: 'Feed', icon: 'feed' },
  { to: '/app/journal', name: 'Journal', icon: 'journal' },
  { to: '/app/skills', name: 'Skills tree', icon: 'skills' },
  { to: '/app/history', name: 'History', icon: 'history' },
  { to: '/app/settings', name: 'Settings', icon: 'settings' },
]

function Workspace() {
  useEntitlementSync()
  const { user } = useAuth()
  const { currentLocation: city, setManualLocation } = useAppLocation()
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('atlas-sidebar-collapsed') === '1')
  const [equipment, setEquipment] = useState<Equipment>(() => { const stored = localStorage.getItem('atlas-feed-equipment'); return stored === 'binoculars' || stored === 'telescope' ? stored : 'eye' })
  const [events, setEvents] = useState<SkyEvent[]>([])
  const [saved, setSaved] = useState<Set<string>>(new Set())
  const [entries, setEntries] = useState<ObservationLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [locationOpen, setLocationOpen] = useState(false)
  const [locationQuery, setLocationQuery] = useState('')
  const [authOpen, setAuthOpen] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)
  const [detail, setDetail] = useState<SkyEvent | null>(null)
  const [calendarScope, setCalendarScope] = useState<'saved' | 'all'>('saved')
  const searchRef = useRef<HTMLInputElement>(null)
  const days = eventLookaheadDays(Boolean(user?.entitled))
  const scopeId = user?.id ?? 'local'
  const category = new URLSearchParams(search).get('category')
  const view = pathname === '/app/events' ? 'collections' : pathname === '/app/calendar' ? 'calendar' : pathname === '/app/journal' ? 'journal' : pathname === '/app/profile' || pathname === '/app/settings' ? 'account' : pathname === '/app/skills' ? 'skills' : pathname === '/app/history' ? 'history' : 'feed'

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      try {
        await pullSkyEvents()
        const now = new Date()
        const [rows, ids, notes] = await Promise.all([
          getEventsInRange(now, new Date(now.getTime() + days * 86400000)),
          getTaggedEventIds(),
          db.observations.where('userId').equals(scopeId).reverse().sortBy('observedAt'),
        ])
        if (!active) return
        setEvents(rows.filter(event => !GUIDE_KIND_IDS.has(event.kind) && isVisibleLocalEvent(event, city.lat, city.lon)))
        setSaved(ids)
        setEntries(notes)
      } catch {
        if (active) setMessage('Could not refresh your sky. Your saved data stays on this device. Try reloading.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [city.lat, city.lon, days, scopeId])

  useEffect(() => { trackEvent('Workspace viewed', { view }); setQuery(''); setMessage(''); window.scrollTo(0, 0) }, [pathname, search, view])
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [])

  const filtered = useMemo(() => events.filter(event => {
    if (!matchesEquipment(event.kind, equipment)) return false
    if (category && categoryForKind(event.kind)?.id !== category) return false
    if (view === 'calendar' && calendarScope === 'saved' && !saved.has(event.id)) return false
    return `${event.title} ${event.description}`.toLowerCase().includes(query.toLowerCase())
  }), [events, category, view, calendarScope, saved, query, equipment])
  const groups = useMemo(() => {
    const result = new Map<string, SkyEvent[]>()
    for (const event of filtered) {
      const ongoing = new Date(event.startsAt).getTime() <= Date.now() && new Date(event.endsAt).getTime() >= Date.now()
      const label = ongoing ? 'Happening now' : new Date(event.startsAt).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: city.timeZone })
      result.set(label, [...(result.get(label) ?? []), event])
    }
    return [...result]
  }, [filtered, city.timeZone])

  async function toggleSave(event: SkyEvent) {
    setPending(event.id)
    try {
      await toggleEventTag(event.id, saved.has(event.id))
      trackEvent('Calendar event changed', { event_id: event.id, kind: event.kind, saved: !saved.has(event.id) })
      setSaved(await getTaggedEventIds())
    } catch {
      setMessage('Could not update your calendar. Please try again.')
    } finally { setPending(null) }
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const title = String(data.get('title') ?? '').trim()
    const note = String(data.get('note') ?? '').trim()
    if (!title) return
    setPending('journal')
    try {
      const entry: ObservationLogEntry = { id: crypto.randomUUID(), userId: scopeId, observedAt: new Date().toISOString(), targetName: title, note, locationLabel: city.name }
      await db.observations.put(entry)
      if (pb.authStore.isValid) await pushObservation(entry)
      trackEvent('Journal entry saved', { has_note: Boolean(note), signed_in: Boolean(user) })
      setEntries(current => [entry, ...current])
      setComposeOpen(false)
    } catch { setMessage('Could not finish saving your note. Please check your journal before trying again.') }
    finally { setPending(null) }
  }

  const title = view === 'collections' ? 'Collections' : view === 'calendar' ? 'Calendar' : view === 'journal' ? 'Journal' : view === 'account' ? 'Settings' : view === 'skills' ? 'Skills tree' : view === 'history' ? 'History' : EVENT_CATEGORIES.find(item => item.id === category)?.label ?? 'Feed'
  const matches = CITIES.filter(item => cityLabel(item).toLowerCase().includes(locationQuery.toLowerCase())).slice(0, 20)

  return <div className={`atlas-workspace${collapsed ? ' rail-collapsed' : ''}`}>
    <div className="workspace-stars"><Starfield dark palette="mono" motion="static" density={110} /></div>
    <nav className="workspace-rail" aria-label="Primary">
      <NavLink to="/app/hub" className="workspace-mark" aria-label="Atlas home">Atlas</NavLink>
      <button type="button" className="rail-collapse" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} onClick={() => { trackEvent('Sidebar toggled', { collapsed: !collapsed }); setCollapsed(!collapsed); localStorage.setItem('atlas-sidebar-collapsed', collapsed ? '0' : '1') }}>{collapsed ? '›' : '‹'}<span className="rail-label">Collapse</span></button>
      <div className="rail-pages">{NAV.map(item => <NavLink key={item.to} to={item.to} title={item.name} aria-label={item.name} className={({ isActive }) => `rail-button rail-${item.icon}${isActive ? ' active' : ''}`}><Icon name={item.icon} /><span className="rail-label">{item.name}</span></NavLink>)}</div>

    </nav>
    <Suspense fallback={<p className="empty-state" role="status">Loading…</p>}><main className={`workspace-document ${view === 'collections' ? 'workspace-document-wide' : ''}`}>
      <div className="document-tools"><button type="button" onClick={() => setLocationOpen(true)}>{city.name} <span aria-hidden="true">⌄</span></button><label className="document-search"><Icon name="search" /><input ref={searchRef} type="search" aria-label="Search" placeholder="Search" value={query} onChange={event => setQuery(event.target.value)} /></label></div>
      <header className="document-heading"><h1>{title}</h1>{view === 'journal' && <button type="button" className="quiet-button" onClick={() => setComposeOpen(true)}>Add entry</button>}</header>
      {message && <p className="workspace-message" role="status">{message}</p>}
      {view === 'skills' ? <SkillsTree entries={entries} userId={scopeId} /> : view === 'history' ? <ObservationHistory entries={entries} query={query} /> : view === 'collections' ? <div className="collection-grid">{EVENT_CATEGORIES.filter(item => item.id !== 'guides' && item.label.toLowerCase().includes(query.toLowerCase())).map(item => {
        const count = events.filter(event => item.kinds.includes(event.kind)).length
        return <button type="button" className="collection-tile" key={item.id} onClick={() => navigate(`/app/hub?category=${item.id}`)}><strong>{item.label}</strong><footer><span className="tile-mark" aria-hidden="true">✦</span><span>{count} {count === 1 ? 'event' : 'events'}</span></footer></button>
      })}</div> : view === 'account' ? <section className="account-content"><h2>{user ? user.email : 'A space for your sky'}</h2><p>{user ? 'Your calendar and journal are connected to your account.' : 'Explore the sky and keep notes on this device. Sign in to keep your observations across devices.'}</p><button type="button" className="quiet-button" onClick={() => user ? signOut() : setAuthOpen(true)}>{user ? 'Sign out' : 'Sign in / create account'}</button><section><h2>Location</h2><p>{city.name}</p><button type="button" className="text-button" onClick={() => setLocationOpen(true)}>Change location</button></section></section> : view === 'journal' ? <section className="journal-list">{entries.length === 0 ? <p className="empty-state">No entries yet. Start with something you noticed tonight.</p> : entries.filter(entry => `${entry.targetName} ${entry.note}`.toLowerCase().includes(query.toLowerCase())).map(entry => <article className="journal-entry" key={entry.id}><time dateTime={entry.observedAt}>{new Date(entry.observedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</time><h2>{entry.targetName || 'An observing night'}</h2>{entry.note && <p>{entry.note}</p>}<small>{entry.locationLabel}</small></article>)}</section> : <>
        <div className="equipment-filter" role="group" aria-label="Viewing equipment">{(['eye', 'binoculars', 'telescope'] as const).map(value => <button type="button" key={value} aria-pressed={equipment === value} onClick={() => { trackEvent('Equipment filter changed', { equipment: value }); setEquipment(value); localStorage.setItem('atlas-feed-equipment', value) }}>{value === 'eye' ? 'Naked eye' : value === 'binoculars' ? 'Binoculars' : 'Telescope'}</button>)}</div>
        {view === 'feed' && <DailyFocus city={city} equipment={equipment} />}
        {view === 'feed' && <FeedBriefing city={city} equipment={equipment} catalogueKey={events.map(event => `${event.id}:${event.updatedAt}`).join('|')} />}
        <h2 className="upcoming-heading">{view === 'calendar' ? 'Saved nights' : 'Coming up'}</h2>
        <div className="document-filter">{view === 'calendar' ? <><button type="button" aria-pressed={calendarScope === 'saved'} onClick={() => setCalendarScope('saved')}>Saved events</button><button type="button" aria-pressed={calendarScope === 'all'} onClick={() => setCalendarScope('all')}>All events</button></> : <button type="button" onClick={() => navigate('/app/events')}>{category ? 'All collections' : 'Collections'} <span aria-hidden="true">⌄</span></button>}</div>
        {loading && <p className="empty-state" role="status">Loading your sky…</p>}
        {!loading && groups.length === 0 && <p className="empty-state">{query ? 'No events match your search.' : view === 'calendar' && calendarScope === 'saved' ? 'Nothing saved yet. Add an event from your feed.' : 'No scheduled events in this window. Try another location or check back later.'}</p>}
        {groups.map(([label, rows]) => <section className="event-section" key={label}><h2>{label}</h2>{rows.map(event => <article className="feed-entry" key={event.id}><p className="feed-entry-category">{categoryForKind(event.kind)?.label}</p><button type="button" className="event-open" onClick={() => { trackEvent('Event details opened', { event_id: event.id, kind: event.kind }); setDetail(event) }}>{event.title}</button>{event.imageUrl && <img className="feed-event-image" src={event.imageUrl} alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true }} />}<div className="event-data"><time dateTime={event.startsAt}>{new Date(event.startsAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', timeZone: city.timeZone })}</time><span>{event.target}</span><span>{event.endsAt && new Date(event.endsAt) > new Date(event.startsAt) ? `Until ${new Date(event.endsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: city.timeZone })}` : ''}</span></div><footer><button type="button" className="text-button" onClick={() => { trackEvent('Event details opened', { event_id: event.id, kind: event.kind }); setDetail(event) }}>Viewing details</button><button type="button" className="quiet-button" aria-label={`${saved.has(event.id) ? 'Remove' : 'Add'} ${event.title} ${saved.has(event.id) ? 'from' : 'to'} calendar`} disabled={pending !== null} onClick={() => void toggleSave(event)}>{pending === event.id ? 'Saving…' : saved.has(event.id) ? 'Remove from calendar' : 'Add to calendar'}</button></footer></article>)}</section>)}
      </>}
    </main></Suspense>
    {locationOpen && <Sheet title="Your location" close={() => setLocationOpen(false)}><input type="search" aria-label="Find a city" placeholder="Find a city" value={locationQuery} onChange={event => setLocationQuery(event.target.value)} /><ul className="city-list">{matches.map(item => <li key={`${item.name}-${item.lat}-${item.lon}`}><button type="button" onClick={() => { setManualLocation(item); setLocationOpen(false) }}>{cityLabel(item)}</button></li>)}</ul>{matches.length === 0 && <p>No matching cities.</p>}</Sheet>}
    {detail && <Sheet title={detail.title} close={() => setDetail(null)}><p className="detail-date">{new Date(detail.startsAt).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short', timeZone: city.timeZone })}</p>{detail.imageUrl && <img className="detail-image" src={detail.imageUrl} alt="" />}<p className="detail-description">{detail.description || 'Viewing details will appear here as they become available.'}</p><button type="button" className="quiet-button" disabled={pending !== null} onClick={() => void toggleSave(detail)}>{saved.has(detail.id) ? 'Remove from calendar' : 'Add to calendar'}</button></Sheet>}
    {composeOpen && <Sheet title="New journal entry" close={() => setComposeOpen(false)}><form onSubmit={event => void addNote(event)}><label>What did you observe?<input name="title" required maxLength={200} /></label><label>Notes<textarea name="note" rows={6} maxLength={10000} /></label><button type="submit" className="quiet-button" disabled={pending !== null}>{pending === 'journal' ? 'Saving…' : 'Save entry'}</button></form></Sheet>}
    {authOpen && <Sheet title="Your Atlas account" close={() => setAuthOpen(false)}><Suspense fallback={<p role="status">Loading sign in…</p>}><AuthForm source="workspace" onSignedIn={() => setAuthOpen(false)} onSignedUp={() => setAuthOpen(false)} /></Suspense></Sheet>}
  </div>
}

export default function App() {
  return <Routes><Route path="/app/*" element={<Workspace />} /><Route path="/tonight" element={<Navigate to="/app/hub" replace />} /><Route path="*" element={<Navigate to="/app/hub" replace />} /></Routes>
}
