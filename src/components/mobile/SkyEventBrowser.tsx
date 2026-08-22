import { useEffect, useMemo, useState } from 'react'
import { KIND_LABELS } from '../../widgets/EventRow'
import { categoryForKind, EVENT_CATEGORIES, GUIDE_KIND_IDS } from '../../lib/eventCategories'
import { dateGroupLabel } from '../../lib/eventFormat'
import { localDateKey } from '../../lib/weather'
import type { SkyEvent } from '../../lib/db'
import { MobileIcon } from './MobileIcon'

type EventStatus = 'go' | 'marginal' | 'poor'
const ALL_CATEGORY_ID = 'all'
const SATELLITE_CATEGORY_ID = 'satellites'

// A single chronological feed of every upcoming event, newest-first by
// date. Category is an optional filter chip (defaults to "All"), not a
// mandatory first step -- a first-time visitor should see what's coming up
// without deciding what kind of astronomy they're into first. Both
// PlanView's Explore mode and EventsView render through this component so
// the two surfaces can never visually drift apart -- change the browsing
// UI here once.
export function SkyEventBrowser({
  events,
  onSelect,
  statusForEvent,
  timeZone,
}: {
  events: SkyEvent[] | null
  onSelect: (event: SkyEvent) => void
  statusForEvent?: (event: SkyEvent) => EventStatus | null
  timeZone?: string
}) {
  const [categoryId, setCategoryId] = useState<string>(ALL_CATEGORY_ID)
  const [query, setQuery] = useState('')
  const [showSatellitePasses, setShowSatellitePasses] = useState(false)
  // Wikimedia hotlinks occasionally fail to load -- fall back to the
  // category icon instead of leaving a blank swatch.
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set())

  const categories = useMemo(
    () => EVENT_CATEGORIES
      .filter((category) => category.id !== SATELLITE_CATEGORY_ID || showSatellitePasses)
      .map((category) => ({ ...category, count: (events ?? []).filter((event) => category.kinds.includes(event.kind)).length })),
    [events, showSatellitePasses],
  )

  const activeCategory = categories.find((category) => category.id === categoryId) ?? null
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const scopedEvents = useMemo(
    () =>
      (events ?? [])
        .filter((event) => {
          if (activeCategory) return activeCategory.kinds.includes(event.kind)
          return showSatellitePasses || (event.kind !== 'iss_pass' && event.kind !== 'satellite_flare')
        })
        .filter((event) => {
          if (!normalizedQuery) return true
          const haystack = `${event.title} ${event.target ?? ''} ${KIND_LABELS[event.kind] ?? event.kind}`.toLocaleLowerCase()
          return haystack.includes(normalizedQuery)
        })
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [events, activeCategory, showSatellitePasses, normalizedQuery],
  )

  // Everything already lives in memory (a bounded upcoming-events window),
  // so "show more" just extends the visible slice -- no refetch, and never
  // a dead-end "go filter differently" message.
  const SHOW_MORE_STEP = 20
  const [visibleCount, setVisibleCount] = useState(SHOW_MORE_STEP)
  useEffect(() => {
    setVisibleCount(SHOW_MORE_STEP)
  }, [categoryId, normalizedQuery])

  const filteredEvents = scopedEvents.slice(0, visibleCount)
  const remainingCount = scopedEvents.length - filteredEvents.length

  function selectCategory(id: string) {
    setCategoryId(id)
  }

  // Group the (already date-sorted) visible slice under bold date rules --
  // Today / Tomorrow / a short weekday+date -- per the feed-row spec: no
  // cards, groups separated by a rule instead.
  const groupedEvents = useMemo(() => {
    const groups = new Map<string, { dateKey: string; label: string; items: SkyEvent[] }>()
    for (const event of filteredEvents) {
      const dateKey = localDateKey(event.startsAt, timeZone)
      const group = groups.get(dateKey)
      if (group) group.items.push(event)
      else groups.set(dateKey, { dateKey, label: dateGroupLabel(event.startsAt, timeZone), items: [event] })
    }
    return [...groups.values()]
  }, [filteredEvents, timeZone])

  return (
    <div>
      <div className="dt-feed-heading">
        <span className="dt-kicker">All events</span>
        <p>Every upcoming event, in time order.</p>
      </div>
      <div className="dt-search-row">
        <MobileIcon name="search" />
        <input
          type="search"
          className="dt-search-input"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Search events"
          aria-label="Search events"
        />
      </div>

      <div className="dt-filter-row">
        <div className="dt-chip-row" role="tablist" aria-label="Event categories">
          <button type="button" className={`dt-chip${categoryId === ALL_CATEGORY_ID ? ' is-active' : ''}`} onClick={() => selectCategory(ALL_CATEGORY_ID)}>
            All
            <span>{scopedEvents.length}</span>
          </button>
          {categories.map((category) => (
            <button
              type="button"
              key={category.id}
              className={`dt-chip${categoryId === category.id ? ' is-active' : ''}`}
              onClick={() => selectCategory(category.id)}
            >
              {category.label}
              <span>{category.count}</span>
            </button>
          ))}
        </div>

      </div>

      <button
        type="button"
        className={`dt-chip dt-satellite-toggle${showSatellitePasses ? ' is-active' : ''}`}
        aria-pressed={showSatellitePasses}
        onClick={() => {
          setShowSatellitePasses((current) => !current)
          setCategoryId(ALL_CATEGORY_ID)
        }}
      >
        Satellite passes {showSatellitePasses ? 'on' : 'off'}
      </button>

      {events === null ? (
        <p className="dt-empty-hint">Loading&hellip;</p>
      ) : filteredEvents.length === 0 ? (
        <p className="dt-empty-hint">{normalizedQuery ? `No events match “${query.trim()}”.` : 'No events in view.'}</p>
      ) : (
        groupedEvents.map((group) => (
          <div key={`event-group-${group.dateKey}`}>
            <div className="dt-today-rule">
              <span>{group.label.toUpperCase()}</span>
              <span />
            </div>
            {group.items.map((event) => {
              const eventStatus = statusForEvent?.(event) ?? null
              const eventCategory = categoryForKind(event.kind)
              const isGuide = GUIDE_KIND_IDS.has(event.kind)
              return (
                <button type="button" className="dt-feed-row dt-feed-row--listing" key={event.id} onClick={() => onSelect(event)}>
                  <span className="dt-feed-swatch" style={eventCategory ? { color: eventCategory.accent } : undefined}>
                    {event.imageUrl && !failedImageIds.has(event.id) ? (
                      <img src={event.imageUrl} alt="" loading="lazy" onError={() => setFailedImageIds((prev) => new Set(prev).add(event.id))} />
                    ) : (
                      <MobileIcon name={eventCategory?.icon ?? 'zap'} />
                    )}
                  </span>
                  <span className="dt-feed-body">
                    <span className="dt-feed-kind">
                      {KIND_LABELS[event.kind] ?? event.kind}
                      {isGuide && <span className="dt-feed-guide-tag">GUIDE</span>}
                    </span>
                    <span className="dt-feed-headline">{event.title}</span>
                  </span>
                  <span className="dt-feed-time">
                    {new Date(event.startsAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone })}
                  </span>
                  <span className={`dt-status-dot${eventStatus ? ` dt-status-dot--${eventStatus}` : ''}`} />
                  <span className="dt-feed-chevron">
                    <MobileIcon name="chevron" />
                  </span>
                </button>
              )
            })}
          </div>
        ))
      )}
      {remainingCount > 0 && (
        <button type="button" className="dt-show-more" onClick={() => setVisibleCount((current) => current + SHOW_MORE_STEP)}>
          Show {Math.min(remainingCount, SHOW_MORE_STEP)} more
        </button>
      )}
    </div>
  )
}
