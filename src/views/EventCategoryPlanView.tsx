import { useEffect, useMemo, useState } from 'react'
import { KIND_LABELS } from '../widgets/EventRow'
import { isLocalEvent } from '../lib/eventFilters'
import { getUpcomingEvents, pullSkyEvents } from '../lib/sync'
import { addGetReadyReminder } from '../lib/getReadyReminders'
import { getDefaultDevice, CAMERA_PROFILES } from '../lib/cameraProfiles'
import { trackEvent } from '../lib/analytics'
import { useAuth } from '../lib/auth'
import { PaywallGate } from '../components/PaywallGate'
import type { SkyEvent } from '../lib/db'

interface EventCategory {
  id: string
  label: string
  kinds: string[]
}

const EVENT_CATEGORIES: EventCategory[] = [
  { id: 'headline', label: 'Timed events', kinds: ['eclipse', 'meteor_shower', 'fireball', 'aurora', 'solar_flare', 'comet'] },
  { id: 'solar-system', label: 'Solar system', kinds: ['moon_phase', 'planet_event', 'conjunction', 'asteroid_approach'] },
  { id: 'orbit', label: 'Orbit passes', kinds: ['iss_pass', 'satellite_flare'] },
  { id: 'deep-sky', label: 'Deep sky', kinds: ['deep_sky'] },
  { id: 'guides', label: 'Sky guides', kinds: ['night_sky_guide', 'local_night_sky'] },
]
const FREE_EVENT_LOOKAHEAD_DAYS = 14

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

export function EventCategoryPlanView({
  lat,
  lon,
  cityName,
  onSignInClick,
}: {
  lat: number
  lon: number
  cityName: string
  onSignInClick: () => void
}) {
  const [events, setEvents] = useState<SkyEvent[] | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [selectedKind, setSelectedKind] = useState<string>('all')
  const [status, setStatus] = useState('')
  const [blockedPlanAdd, setBlockedPlanAdd] = useState(false)
  const { user } = useAuth()
  const hasPremium = Boolean(user?.entitled)

  useEffect(() => {
    let cancelled = false
    async function load() {
      await pullSkyEvents()
      const upcoming = await getUpcomingEvents(FREE_EVENT_LOOKAHEAD_DAYS)
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

  async function addEventToPlan(event: SkyEvent) {
    if (!hasPremium) {
      setBlockedPlanAdd(true)
      setStatus('Sky Pass is required to add events to a plan. Browsing and check-ins stay free.')
      trackEvent('Blocked free plan add', { action: 'event_plan', source: 'desktop_plan' })
      return
    }

    await addGetReadyReminder({
      eventId: event.id,
      title: event.title,
      kind: event.kind,
      target: event.target,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      deviceName: CAMERA_PROFILES[getDefaultDevice()].name,
      lat,
      lon,
    })
    setStatus(`${event.title} added to your plan.`)
    trackEvent('Added event to desktop plan', { eventId: event.id, kind: event.kind })
  }

  return (
    <section className="widget-section event-plan">
      <div className="event-plan-header">
        <div>
          <h2>Events by category</h2>
          <p className="planner-hint">Every local event type cached for {cityName} over the next two weeks.</p>
        </div>
        <span className="event-plan-count">{events?.length ?? '...'}</span>
      </div>
      {status && <p className="planner-reminder-status">{status}</p>}
      {blockedPlanAdd && !hasPremium && (
        <PaywallGate
          user={user}
          feature="Add to plan"
          description="Saving events to a plan, get-ready reminders, and holiday planning are part of the Sky Pass."
          freeNote="You can keep browsing every local event type for the next two weeks for free."
          onSignInClick={onSignInClick}
        >
          {null}
        </PaywallGate>
      )}

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
                    <button type="button" className="event-plan-add-button" onClick={() => addEventToPlan(event)}>
                      Add to plan
                    </button>
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
