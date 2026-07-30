import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { registerWidget } from './registry'
import { HighlightCards } from '../components/HighlightCards'
import { useAuth } from '../lib/auth'
import { getEventsInRange, pullSkyEvents } from '../lib/sync'
import { isGlobalEvent } from '../lib/eventFilters'
import { isRealEvent } from '../lib/eventCategories'
import { listDiscoveries, type Discovery } from '../lib/discoveries'
import { useLocationBrowse } from '../lib/locationBrowseContext'
import type { SkyEvent } from '../lib/db'

// Long enough to reliably include the next eclipse/meteor peak even in a
// slow stretch; bounded so the query/render stays cheap.
const GLOBAL_FEED_WINDOW_DAYS = 60

function GlobalEventsFeedWidget() {
  const { user } = useAuth()
  const { city } = useLocationBrowse()
  const entitled = Boolean(user?.entitled)
  const [events, setEvents] = useState<SkyEvent[] | null>(null)
  const [discoveries, setDiscoveries] = useState<Discovery[]>([])

  useEffect(() => {
    if (!entitled) return
    let cancelled = false
    async function load() {
      await pullSkyEvents()
      const start = new Date()
      const end = new Date(start.getTime() + GLOBAL_FEED_WINDOW_DAYS * 86_400_000)
      const inRange = await getEventsInRange(start, end)
      if (!cancelled) setEvents(inRange.filter((event) => isGlobalEvent(event) && isRealEvent(event.kind)))
    }
    load()
    listDiscoveries().then((result) => {
      if (!cancelled) setDiscoveries(result)
    })
    return () => {
      cancelled = true
    }
  }, [entitled])

  if (!entitled) {
    return (
      <p className="scrapbook-hint">
        See every global sky event coming up — eclipses, meteor showers, conjunctions, aurora activity — regardless
        of location, with <Link to="/app/settings">Sky Pass</Link>.
      </p>
    )
  }

  if (events === null) return <p>Loading&hellip;</p>
  if (events.length === 0) return <p>No global events cached for the next {GLOBAL_FEED_WINDOW_DAYS} days yet.</p>

  return (
    <HighlightCards
      events={events}
      limit={events.length}
      examplePhotos={{ discoveries, city: { lat: city.lat, lon: city.lon } }}
      className="highlight-cards--global-feed"
    />
  )
}

registerWidget({
  id: 'global-events-feed',
  title: 'Global sky highlights',
  Component: GlobalEventsFeedWidget,
  defaultEnabled: true,
})
