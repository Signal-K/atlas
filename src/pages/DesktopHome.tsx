import { useEffect, useState } from 'react'
import { Starfield } from '../components/mobile/Starfield'
import { getEventsInRange, pullSkyEvents } from '../lib/sync'
import { getTaggedEventIds, toggleEventTag } from '../lib/eventTags'
import { categoryForKind, GUIDE_KIND_IDS } from '../lib/eventCategories'
import { isVisibleLocalEvent } from '../lib/eventFilters'
import { eventLookaheadDays } from '../lib/entitlementLimits'
import { useAuth } from '../lib/auth'
import type { CurrentLocation } from '../lib/currentLocation'
import type { SkyEvent } from '../lib/db'

export function DesktopHome({ city, onOpenLocation }: { city: CurrentLocation; onOpenLocation: () => void }) {
  const { user } = useAuth()
  const [events, setEvents] = useState<SkyEvent[] | null>(null)
  const [saved, setSaved] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState('')
  const days = eventLookaheadDays(Boolean(user?.entitled))
  useEffect(() => {
    let active = true
    async function load() {
      try {
        await pullSkyEvents()
        const now = new Date()
        const [rows, ids] = await Promise.all([getEventsInRange(now, new Date(now.getTime() + days * 86400000)), getTaggedEventIds()])
        if (!active) return
        setEvents(rows.filter(event => !GUIDE_KIND_IDS.has(event.kind) && isVisibleLocalEvent(event, city.lat, city.lon)))
        setSaved(ids)
      } catch {
        if (active) setError('Could not load the feed. Please reload to try again.')
      }
    }
    void load()
    return () => { active = false }
  }, [city.lat, city.lon, days])

  async function save(event: SkyEvent) {
    setPending(event.id)
    setError('')
    try {
      await toggleEventTag(event.id, saved.has(event.id))
      setSaved(await getTaggedEventIds())
    } catch {
      setError('Could not save this event. Please try again.')
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="feed-only">
      <div className="feed-only-stars"><Starfield dark palette="mono" motion="static" density={80} /></div>
      <main className="feed-only-column">
        <header className="feed-only-header"><a href="/app/hub" aria-label="Atlas feed">atlas</a><button type="button" onClick={onOpenLocation}>{city.name} <span aria-hidden="true">⌄</span></button></header>
        <h1>Feed</h1>
        {error && <p role="alert">{error}</p>}
        {events === null && !error && <p role="status">Loading events…</p>}
        {events?.length === 0 && <p className="feed-only-empty">No upcoming events for this location.</p>}
        {events?.map(event => (
          <article className="feed-only-post" key={event.id}>
            <div className="feed-only-meta"><span>{categoryForKind(event.kind)?.label ?? event.kind.replaceAll('_', ' ')}</span><time dateTime={event.startsAt}>{new Date(event.startsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: city.timeZone })}</time></div>
            <h2>{event.title}</h2>
            {event.imageUrl && <img src={event.imageUrl} alt="" loading="lazy" />}
            {event.description && <p>{event.description}</p>}
            <footer><span>{new Date(event.startsAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', timeZone: city.timeZone })}</span><button type="button" aria-pressed={saved.has(event.id)} disabled={pending !== null} onClick={() => void save(event)}>{pending === event.id ? 'Saving…' : saved.has(event.id) ? 'Saved ✓' : 'Add to calendar +'}</button></footer>
          </article>
        ))}
      </main>
    </div>
  )
}
