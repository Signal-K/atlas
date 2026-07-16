import { useMemo, useState } from 'react'
import { KIND_LABELS } from '../../widgets/EventRow'
import { categoryForKind, EVENT_CATEGORIES } from '../../lib/eventCategories'
import { dateGroupLabel } from '../../lib/eventFormat'
import type { SkyEvent } from '../../lib/db'
import { BackIcon, MobileIcon } from './MobileIcon'

type EventStatus = 'go' | 'marginal' | 'poor'
type ViewMode = 'list' | 'calendar'
type Step = 'categories' | 'browse'

// The category-grid / type-chip / list-or-calendar event browser. Used
// as-is by both PlanView's Explore mode and EventsView so the two surfaces
// can never visually drift apart -- change the browsing UI here once.
//
// A user flow, not a control panel: step 1 is just "pick a category" (one
// screen, one decision). Step 2 is that category's events, with its own
// back button -- type chips, the list/calendar toggle, and the day strip
// never show until a category is chosen, and the category grid is gone
// once it has.
export function SkyEventBrowser({
  events,
  onSelect,
  statusForEvent,
}: {
  events: SkyEvent[] | null
  onSelect: (event: SkyEvent) => void
  statusForEvent?: (event: SkyEvent) => EventStatus | null
}) {
  const [step, setStep] = useState<Step>('categories')
  const [categoryId, setCategoryId] = useState<string>(EVENT_CATEGORIES[0].id)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  // Wikimedia hotlinks occasionally fail to load -- fall back to the
  // category icon instead of leaving a blank swatch.
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const categories = useMemo(
    () => EVENT_CATEGORIES.map((category) => ({ ...category, count: (events ?? []).filter((event) => category.kinds.includes(event.kind)).length })),
    [events],
  )

  const activeCategory = categories.find((category) => category.id === categoryId) ?? categories[0]
  const categoryEvents = useMemo(() => (events ?? []).filter((event) => activeCategory.kinds.includes(event.kind)), [events, activeCategory])

  const types = useMemo(() => {
    const kinds = Array.from(new Set(categoryEvents.map((event) => event.kind)))
    return [
      { id: 'all', label: 'All', count: categoryEvents.length },
      ...kinds.map((kind) => ({ id: kind, label: KIND_LABELS[kind] ?? kind, count: categoryEvents.filter((event) => event.kind === kind).length })),
    ]
  }, [categoryEvents])

  const scopedEvents = useMemo(
    () => categoryEvents.filter((event) => typeFilter === 'all' || event.kind === typeFilter).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [categoryEvents, typeFilter],
  )

  const days = useMemo(() => {
    return Array.from({ length: 14 }).map((_, i) => {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() + i)
      const dateKey = d.toISOString().slice(0, 10)
      const hasEvents = scopedEvents.some((event) => event.startsAt.slice(0, 10) === dateKey)
      return { dateKey, date: d, hasEvents }
    })
  }, [scopedEvents])

  const dayFilteredEvents = useMemo(() => {
    if (viewMode !== 'calendar' || !selectedDay) return scopedEvents
    return scopedEvents.filter((event) => event.startsAt.slice(0, 10) === selectedDay)
  }, [scopedEvents, viewMode, selectedDay])

  // Keep the card to a scannable preview instead of dumping an entire
  // category (some, like Solar system, run 20+ events deep) -- narrow with
  // a type chip or a calendar day to see more of a specific slice.
  const EVENT_PREVIEW_LIMIT = 6
  const filteredEvents = dayFilteredEvents.slice(0, EVENT_PREVIEW_LIMIT)
  const hiddenCount = dayFilteredEvents.length - filteredEvents.length

  function selectCategory(id: string) {
    setCategoryId(id)
    setTypeFilter('all')
    setSelectedDay(null)
    setStep('browse')
  }

  // Group the (already date-sorted) preview slice under bold date rules --
  // Today / Tomorrow / a short weekday+date -- per the feed-row spec: no
  // cards, groups separated by a rule instead.
  const groupedEvents = useMemo(() => {
    const groups: Array<{ label: string; items: SkyEvent[] }> = []
    for (const event of filteredEvents) {
      const label = dateGroupLabel(event.startsAt)
      const last = groups[groups.length - 1]
      if (last && last.label === label) last.items.push(event)
      else groups.push({ label, items: [event] })
    }
    return groups
  }, [filteredEvents])

  if (step === 'categories') {
    return (
      <div className="dt-category-list">
        {categories.map((category) => (
          <button type="button" key={category.id} className="dt-category-row" onClick={() => selectCategory(category.id)}>
            <span className="dt-category-icon" style={{ color: category.accent }}>
              <MobileIcon name={category.icon} />
            </span>
            <strong>{category.label}</strong>
            <span className="dt-category-count" style={{ color: category.accent }}>
              {category.count}
            </span>
            <MobileIcon name="chevron" />
          </button>
        ))}
      </div>
    )
  }

  return (
    <div>
      <button type="button" className="dt-back-row" onClick={() => setStep('categories')}>
        <BackIcon />
        <span className="dt-category-icon" style={{ color: activeCategory.accent, width: 26, height: 26 }}>
          <MobileIcon name={activeCategory.icon} />
        </span>
        <strong>{activeCategory.label}</strong>
      </button>

      <div className="dt-filter-row">
        <div className="dt-chip-row" role="tablist" aria-label="Event types">
          {types.map((type) => (
            <button type="button" key={type.id} className={`dt-chip${typeFilter === type.id ? ' is-active' : ''}`} onClick={() => setTypeFilter(type.id)}>
              {type.label}
              <span>{type.count}</span>
            </button>
          ))}
        </div>

        <div className="dt-view-toggle">
          <button
            type="button"
            className={viewMode === 'list' ? 'is-active' : ''}
            onClick={() => {
              setViewMode('list')
              setSelectedDay(null)
            }}
          >
            List
          </button>
          <button type="button" className={viewMode === 'calendar' ? 'is-active' : ''} onClick={() => setViewMode('calendar')}>
            Calendar
          </button>
        </div>
      </div>

      {viewMode === 'calendar' && (
        <div className="dt-day-strip">
          {days.map((day) => (
            <button
              type="button"
              key={day.dateKey}
              className={`dt-day-chip${selectedDay === day.dateKey ? ' is-active' : ''}`}
              onClick={() => setSelectedDay((current) => (current === day.dateKey ? null : day.dateKey))}
            >
              <span>{day.date.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2).toUpperCase()}</span>
              <strong>{day.date.getDate()}</strong>
              <span className={`dt-day-chip-dot${day.hasEvents ? ' has-events' : ''}`} />
            </button>
          ))}
        </div>
      )}

      {events === null ? (
        <p className="dt-empty-hint">Loading&hellip;</p>
      ) : filteredEvents.length === 0 ? (
        <p className="dt-empty-hint">No events in view.</p>
      ) : (
        groupedEvents.map((group) => (
          <div key={group.label}>
            <div className="dt-today-rule">
              <span>{group.label.toUpperCase()}</span>
              <span />
            </div>
            {group.items.map((event) => {
              const eventStatus = statusForEvent?.(event) ?? null
              const eventCategory = categoryForKind(event.kind)
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
                    {typeFilter === 'all' && <span className="dt-feed-kind">{KIND_LABELS[event.kind] ?? event.kind}</span>}
                    <span className="dt-feed-headline">{event.title}</span>
                  </span>
                  <span className="dt-feed-time">
                    {new Date(event.startsAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
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
      {hiddenCount > 0 && <p className="dt-empty-hint">+{hiddenCount} more — narrow by type or pick a calendar day to see them.</p>}
    </div>
  )
}
