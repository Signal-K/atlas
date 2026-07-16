import { useEffect, useMemo, useState } from 'react'
import { KIND_LABELS } from '../widgets/EventRow'
import { isLocalEvent } from '../lib/eventFilters'
import { getUpcomingEvents, pullSkyEvents } from '../lib/sync'
import type { SkyEvent } from '../lib/db'

interface EventCategory {
  id: string
  label: string
  kinds: string[]
}

const EVENT_CATEGORIES: EventCategory[] = [
  { id: 'headline', label: 'Timed events', kinds: ['eclipse', 'meteor_shower', 'aurora', 'comet'] },
  { id: 'solar-system', label: 'Solar system', kinds: ['moon_phase', 'planet_event', 'conjunction'] },
  { id: 'orbit', label: 'Orbit passes', kinds: ['iss_pass', 'satellite_flare'] },
  { id: 'deep-sky', label: 'Deep sky', kinds: ['deep_sky'] },
  { id: 'guides', label: 'Sky guides', kinds: ['night_sky_guide', 'local_night_sky'] },
]

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function categoryForEvent(event: SkyEvent): EventCategory {
  return EVENT_CATEGORIES.find((category) => category.kinds.includes(event.kind)) ?? {
    id: 'other',
    label: 'Other',
    kinds: [event.kind],
  }
}

function typeSummary(events: SkyEvent[]): string {
  return Array.from(new Set(events.map((event) => KIND_LABELS[event.kind] ?? event.kind)))
    .slice(0, 3)
    .join(' / ')
}

export function EventCategoryPlanView({ lat, lon, cityName }: { lat: number; lon: number; cityName: string }) {
  const [events, setEvents] = useState<SkyEvent[] | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [selectedKind, setSelectedKind] = useState<string>('all')

  useEffect(() => {
    let cancelled = false
    async function load() {
      await pullSkyEvents()
      const upcoming = await getUpcomingEvents(240)
      if (!cancelled) setEvents(upcoming.filter((event) => isLocalEvent(event, lat, lon)))
    }
    load()
    return () => {
      cancelled = true
    }
  }, [lat, lon])

  const grouped = useMemo(() => {
    if (!events) return []
    const buckets = new Map<string, { category: EventCategory; events: SkyEvent[] }>()
    for (const event of events) {
      const category = categoryForEvent(event)
      const bucket = buckets.get(category.id) ?? { category, events: [] }
      bucket.events.push(event)
      buckets.set(category.id, bucket)
    }
    return Array.from(buckets.values()).sort((a, b) => {
      const aIndex = EVENT_CATEGORIES.findIndex((category) => category.id === a.category.id)
      const bIndex = EVENT_CATEGORIES.findIndex((category) => category.id === b.category.id)
      return (aIndex === -1 ? EVENT_CATEGORIES.length : aIndex) - (bIndex === -1 ? EVENT_CATEGORIES.length : bIndex)
    })
  }, [events])

  const activeGroup = grouped.find((group) => group.category.id === selectedCategoryId) ?? grouped[0] ?? null
  const activeTypes = activeGroup
    ? Array.from(new Set(activeGroup.events.map((event) => event.kind))).map((kind) => ({
        kind,
        label: KIND_LABELS[kind] ?? kind,
        count: activeGroup.events.filter((event) => event.kind === kind).length,
      }))
    : []
  const visibleEvents = activeGroup
    ? selectedKind === 'all'
      ? activeGroup.events
      : activeGroup.events.filter((event) => event.kind === selectedKind)
    : []

  function selectCategory(id: string) {
    setSelectedCategoryId(id)
    setSelectedKind('all')
  }

  return (
    <section className="widget-section event-plan">
      <div className="event-plan-header">
        <div>
          <h2>Events by category</h2>
          <p className="planner-hint">Every upcoming local event type cached for {cityName}.</p>
        </div>
        <span className="event-plan-count">{events?.length ?? '...'}</span>
      </div>

      {events === null ? (
        <p>Loading events…</p>
      ) : events.length === 0 ? (
        <p>No local events cached for {cityName} yet.</p>
      ) : (
        <>
          <div className="event-plan-category-grid">
            {grouped.map(({ category, events: categoryEvents }) => (
              <button
                type="button"
                className={`event-plan-category${activeGroup?.category.id === category.id ? ' is-active' : ''}`}
                key={category.id}
                onClick={() => selectCategory(category.id)}
              >
                <span>{category.label}</span>
                <strong>{categoryEvents.length}</strong>
              </button>
            ))}
          </div>

          {activeGroup && (
            <section className="event-plan-group">
              <div className="event-plan-group-head">
                <div>
                  <h3>{activeGroup.category.label}</h3>
                  <span>{typeSummary(activeGroup.events)}</span>
                </div>
                <strong>{visibleEvents.length}</strong>
              </div>
              <div className="event-plan-type-row" role="tablist" aria-label="Event types">
                <button type="button" className={selectedKind === 'all' ? 'is-active' : ''} onClick={() => setSelectedKind('all')}>
                  All
                </button>
                {activeTypes.map((type) => (
                  <button
                    type="button"
                    className={selectedKind === type.kind ? 'is-active' : ''}
                    key={type.kind}
                    onClick={() => setSelectedKind(type.kind)}
                  >
                    {type.label}
                    <span>{type.count}</span>
                  </button>
                ))}
              </div>
              <div className="event-plan-list">
                {visibleEvents.slice(0, 10).map((event) => (
                  <article className="event-plan-item" key={event.id}>
                    <span className="row-kind">{KIND_LABELS[event.kind] ?? event.kind}</span>
                    <strong>{event.title}</strong>
                    <small>{formatEventDate(event.startsAt)}</small>
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </section>
  )
}
