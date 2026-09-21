import { useEffect, useMemo, useState } from 'react'
import { trackEvent } from '../lib/analytics'
import { pullSkyEvents, getEventsInRange } from '../lib/sync'
import type { SkyEvent } from '../lib/db'
import { metaFor, type TargetDifficulty } from '../lib/tonightTargets'
import { SKY_PASS_SUMMARY } from '../lib/pricing'
import { localDateKey } from '../lib/weather'
import { fetchEvents as fetchConjunctionEvents } from '../lib/eventSources/conjunctions.mjs'
import { fetchEvents as fetchEclipseEvents } from '../lib/eventSources/eclipses.mjs'
import { fetchEvents as fetchMeteorShowerEvents } from '../lib/eventSources/meteor-showers.mjs'
import { fetchEvents as fetchPlanetEvents } from '../lib/eventSources/planets.mjs'

interface LandingPageProps {
  authenticatedEmail?: string
  onEnter: () => void
  // Sky Pass CTAs must land on a paywalled screen (not the free Hub), so the
  // already-working checkout button in PaywallGate is what the visitor sees
  // next -- see ASV-51: the landing page never wired "Get Sky Pass" to any
  // checkout path at all.
  onEnterPaid: () => void
}

type CtaSource = 'nav' | 'hero' | 'membership-free' | 'membership-paid' | 'footer'

interface EventRow {
  dateKey: string
  weekdayLabel: string
  dayLabel: string
  title: string
  description: string
  difficulty: TargetDifficulty
  timeLabel: string
  isPick: boolean
}

const GEAR_META: Record<TargetDifficulty, { label: string; color: string }> = {
  easy: { label: 'Eyes', color: '#5b87a8' },
  moderate: { label: 'Binoculars', color: '#7ea888' },
  hard: { label: 'Telescope', color: '#c4685c' },
}

// Times are shown in the visitor's own zone: the landing page is global and
// deliberately knows nothing about where the visitor is.
function formatLocalTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
}

// The landing page is a cover, not a calendar. Show five strong real events in
// the next month, with a different kind of sky event in each slot where the
// catalogue allows it. Moon phases belong in the mix; they just should not
// crowd every other kind of astronomy out of the list.
function buildEventRows(events: SkyEvent[]): EventRow[] {
  const landingPriority = (event: SkyEvent) => {
    if (event.kind === 'eclipse') return 1
    if (event.kind === 'meteor_shower') return 2
    if (event.kind === 'conjunction') return 3
    if (event.kind === 'planet_event') return 4
    if (event.kind === 'moon_phase') return 5
    if (event.kind === 'bright_star') return 6
    if (event.kind === 'deep_sky') return 7
    if (event.kind === 'telescope_target') return 8
    return Number.POSITIVE_INFINITY
  }
  const uniqueEvents = new Map<string, SkyEvent>()
  for (const event of events) {
    const key = `${event.kind}|${event.target}|${event.startsAt}`
    if (!uniqueEvents.has(key)) uniqueEvents.set(key, event)
  }

  const rankedEvents = Array.from(uniqueEvents.values())
    .filter((event) => Number.isFinite(landingPriority(event)))
    .sort((a, b) => {
      const priorityDiff = landingPriority(a) - landingPriority(b)
      return priorityDiff !== 0 ? priorityDiff : a.startsAt.localeCompare(b.startsAt)
    })
  const selected: SkyEvent[] = []
  const kindCounts = new Map<string, number>()
  const kindCaps = new Map<string, number>([['conjunction', 1]])

  const capForKind = (kind: string) => kindCaps.get(kind) ?? 2

  // First take one of every available kind. This is what prevents five Moon
  // phases, or five conjunctions, from becoming the whole landing page.
  for (const event of rankedEvents) {
    if (selected.length >= 5 || kindCounts.has(event.kind)) continue
    selected.push(event)
    kindCounts.set(event.kind, 1)
  }
  // If fewer than five kinds exist in the window, fill the remaining slots,
  // but keep conjunctions to one entry so they do not crowd out Moon phases,
  // planets, stars, or the other real event types.
  for (const event of rankedEvents) {
    if (selected.length >= 5) break
    const count = kindCounts.get(event.kind) ?? 0
    if (count >= capForKind(event.kind) || selected.includes(event)) continue
    selected.push(event)
    kindCounts.set(event.kind, count + 1)
  }

  return selected
    .map((event, index) => {
      const meta = metaFor(event.kind)
      const eventDate = new Date(event.startsAt)
      const durationHours = (new Date(event.endsAt).getTime() - eventDate.getTime()) / 3_600_000
      return {
        dateKey: `${localDateKey(event.startsAt)}-${event.id}`,
        weekdayLabel: eventDate.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase(),
        dayLabel: eventDate.toLocaleDateString(undefined, { day: 'numeric' }),
        title: event.title,
        description: event.description || meta.reason,
        difficulty: meta.difficulty,
        timeLabel: durationHours >= 8 ? 'All night' : formatLocalTime(event.startsAt),
        isPick: index === 0,
      }
    })
}

export function LandingPage({ authenticatedEmail, onEnter, onEnterPaid }: LandingPageProps) {
  const [eventRows, setEventRows] = useState<EventRow[] | null>(null)

  useEffect(() => {
    trackEvent('Viewed landing page', { authenticated: Boolean(authenticatedEmail) })
    // Only track the initial view of this mount, not every prop change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false
    const now = new Date()

    async function loadEvents() {
      try {
        try {
          await pullSkyEvents()
        } catch (err) {
          trackEvent('sync_failed', { stage: 'landing_month_events_sync', error: String(err) })
        }
        const monthEnd = new Date(now.getTime() + 30 * 86_400_000)
        const [cachedEvents, generatedResults] = await Promise.all([
          getEventsInRange(now, monthEnd),
          Promise.allSettled([
            fetchConjunctionEvents({ now, windowDays: 30 }),
            fetchEclipseEvents({ now, windowDays: 30 }),
            fetchMeteorShowerEvents({ now, windowDays: 30 }),
            fetchPlanetEvents({ now, windowDays: 30 }),
          ]),
        ])
        const computedEvents: SkyEvent[] = generatedResults
          .flatMap((result) => result.status === 'fulfilled' ? result.value : [])
          .map((event, index) => ({
            id: `landing-${event.kind}-${event.target}-${event.starts_at}-${index}`,
            kind: event.kind,
            target: event.target,
            title: event.title,
            description: event.description,
            content: event.content,
            startsAt: event.starts_at,
            endsAt: event.ends_at ?? event.starts_at,
            updatedAt: now.toISOString(),
          }))
        if (!cancelled) setEventRows(buildEventRows([...cachedEvents, ...computedEvents]))
      } catch (err) {
        if (!cancelled) setEventRows([])
        trackEvent('sync_failed', { stage: 'landing_month_events', error: String(err) })
      }
    }

    loadEvents()
    return () => {
      cancelled = true
    }
  }, [])

  const eventRangeLabel = useMemo(() => {
    const now = new Date()
    const end = new Date(now.getTime() + 30 * 86_400_000)
    const start = now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })
    const endLabel = end.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long' })
    return `${start} — ${endLabel}`
  }, [])
  const todayLabel = useMemo(() => new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }), [])

  function handleEnter(source: CtaSource) {
    trackEvent('Landing CTA clicked', { method: authenticatedEmail ? 'open_app' : 'get_started', source })
    if (source === 'membership-paid') {
      onEnterPaid()
    } else {
      onEnter()
    }
  }

  const primaryLabel = authenticatedEmail ? 'Open Atlas' : 'See tonight’s sky'
  const heroNote = authenticatedEmail ? `Signed in as ${authenticatedEmail}.` : `No account needed. ${SKY_PASS_SUMMARY}`

  return (
    <div className="atlas-almanac">
      <header className="am-masthead">
        <div className="am-masthead-meta">
          <span>{todayLabel}</span>
          <span>{eventRangeLabel}</span>
        </div>
        <div className="am-masthead-title">
          <div className="am-wordmark">ATLAS</div>
          <div className="am-tagline">The observer's almanac</div>
        </div>
        <nav className="am-nav" aria-label="Primary">
          <div className="am-nav-links">
            <a href="#week">Highlights</a>
            <a href="#membership">Sky Pass</a>
          </div>
          <button type="button" className="am-nav-cta" onClick={() => handleEnter('nav')}>
            {primaryLabel} →
          </button>
        </nav>
      </header>

      <main id="top">
        <section className="am-lede" aria-labelledby="am-hero-title">
          <div className="am-lede-copy">
            <h1 id="am-hero-title">
              Know what is worth looking up for.
            </h1>
            <div className="am-lede-columns">
              <p>
                <span className="am-dropcap">A</span>tlas picks five real sky events from the next month —
                Moon phases, bright planets, conjunctions, eclipses, meteor showers and standout stars — and tells you when they happen.
              </p>
              <p>
                Set your location to see what is visible from where you stand.
              </p>
            </div>
            <div className="am-lede-actions">
              <button type="button" className="am-btn am-btn-primary" onClick={() => handleEnter('hero')}>
                {primaryLabel}
              </button>
              <span className="am-lede-note">{heroNote}</span>
            </div>
          </div>

        </section>

        <section id="week" className="am-section am-week" aria-labelledby="am-week-title">
          <div className="am-section-head">
            <h2 id="am-week-title">The next five flagship events</h2>
            <div className="am-legend">
              {(Object.keys(GEAR_META) as TargetDifficulty[]).map((key) => (
                <span key={key} className="am-legend-item">
                  <span className="am-legend-dot" style={{ background: GEAR_META[key].color }} />
                  {GEAR_META[key].label}
                </span>
              ))}
            </div>
          </div>

          <div className="am-week-table" role="table" aria-label="The next five flagship sky events">
            <div className="am-week-row am-week-row--head" role="row">
              <div role="columnheader">Night</div>
              <div role="columnheader">Event</div>
              <div role="columnheader">What you'll see</div>
              <div role="columnheader">Time</div>
            </div>

            {eventRows === null ? Array.from({ length: 5 }).map((_, index) => (
              <div className="am-week-row" role="row" key={index}>
                <div className="am-week-loading" role="cell">
                  Loading the next month’s sky…
                </div>
              </div>
            )) : eventRows.length === 0 ? (
              <div className="am-week-row" role="row">
                <div className="am-week-loading" role="cell">
                  A quiet month ahead. Atlas will surface the next event as soon as there is something worth planning around.
                </div>
              </div>
            ) : eventRows.map((row) => (
              <div className={`am-week-row${row.isPick ? ' am-week-row--pick' : ''}`} role="row" key={row.dateKey}>
                <div className="am-week-date" role="cell">
                  {row.weekdayLabel} {row.dayLabel}
                </div>
                <div className="am-week-event" role="cell">
                  <span className="am-legend-dot" style={{ background: GEAR_META[row.difficulty].color }} />
                  <span className="am-week-event-title">{row.title}</span>
                  {row.isPick && <span className="am-pick-badge">Pick of the month</span>}
                </div>
                <div className="am-week-desc" role="cell">
                  {row.description}
                </div>
                <div className="am-week-time" role="cell">
                  {row.timeLabel}
                </div>
              </div>
            ))}
          </div>

          <div className="am-week-foot">
            <span>Global highlights, times in your own zone. Set a location and Atlas tailors these events to your sky.</span>
            <button type="button" className="am-link-btn" onClick={() => handleEnter('nav')}>
              Set your location →
            </button>
          </div>
        </section>

        <section id="membership" className="am-section am-membership" aria-labelledby="am-membership-title">
          <div className="am-section-head">
            <h2 id="am-membership-title">Start with tonight.</h2>
            <span className="am-section-note">Free to see what is up.</span>
          </div>
          <div className="am-plan am-plan--compact">
            <p>Atlas turns your location, weather and the event calendar into a short plan you can actually use.</p>
            <div className="am-lede-actions">
              <button type="button" className="am-btn am-btn-primary" onClick={() => handleEnter('membership-free')}>
                {primaryLabel}
              </button>
              <button type="button" className="am-link-btn" onClick={() => handleEnter('membership-paid')}>
                Get Sky Pass →
              </button>
            </div>
          </div>
        </section>

      </main>

      <footer className="am-colophon">
        <div className="am-colophon-grid">
          <div className="am-colophon-brand">
            <div className="am-wordmark am-wordmark--small">ATLAS</div>
            <p>The short list of what is worth looking up for.</p>
            <button type="button" className="am-btn am-btn-outline" onClick={() => handleEnter('footer')}>
              {primaryLabel}
            </button>
          </div>
          <div className="am-colophon-col">
            <span>The app</span>
            <a href="#week">Highlights</a>
            <a href="#membership">Membership</a>
          </div>
        </div>
        <div className="am-colophon-legal">
          <span>© {new Date().getFullYear()} Atlas</span>
          <span>Star Sailors</span>
        </div>
      </footer>
    </div>
  )
}
