import { useEffect, useMemo, useState } from 'react'
import { trackEvent } from '../lib/analytics'
import { pullSkyEvents, getEventsInRange } from '../lib/sync'
import type { SkyEvent } from '../lib/db'
import { metaFor, type TargetDifficulty } from '../lib/tonightTargets'
import { isMoonWaxingAt, moonIlluminationPctAt, moonPhaseNameAt } from '../lib/moonPhase'
import { moonLitPath } from '../lib/moonDisc.mjs'
import { SKY_PASS_SUMMARY, SKY_PASS_TIERS } from '../lib/pricing'
import { localDateKey } from '../lib/weather'
import { fetchEvents as fetchConjunctionEvents } from '../lib/eventSources/conjunctions.mjs'
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

interface WeekRow {
  dateKey: string
  weekdayLabel: string
  dayLabel: string
  title: string
  description: string
  difficulty: TargetDifficulty
  timeLabel: string
  isPick: boolean
  isFallback: boolean
}

interface TonightSnapshot {
  moonLabel: string
  moonIlluminationPct: number
  moonWaxing: boolean
}

const GEAR_META: Record<TargetDifficulty, { label: string; color: string }> = {
  easy: { label: 'Eyes', color: '#5b87a8' },
  moderate: { label: 'Binoculars', color: '#7ea888' },
  hard: { label: 'Telescope', color: '#c4685c' },
}

const FAQS = [
  {
    q: 'I live in a city. Is there any point?',
    a: 'Yes, and Atlas is honest about which point. From a bright street the Moon, the planets, double stars and the brighter clusters are all yours. The faint fuzzy things get marked as a drive, not a disappointment.',
  },
  {
    q: "I don't own a telescope.",
    a: 'Most weeks the best entry needs nothing but eyes and a coat. Set your gear to eyes only in Settings and the table shortens rather than fills with things you cannot reach.',
  },
  {
    q: 'Can it help my photography?',
    a: 'Tell it your camera and lens and each entry carries a starting exposure and a tracking note for that object at that altitude.',
  },
  {
    q: "What if it's cloudy all week?",
    a: 'It says so plainly, and points you to the next clear night or the nearest dark-sky drive with a gap in the cloud. A quiet week is better information than a hopeful one.',
  },
]

// Times are shown in the visitor's own zone: the landing page is global and
// deliberately knows nothing about where the visitor is.
function formatLocalTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
}

// One flagship event per day, chosen globally. The landing page should put a
// conjunction or planetary event ahead of a routine lunar phase when they
// share a date: the point of this table is to make the sky feel alive, not to
// let the Moon crowd out every other kind of astronomy.
function buildWeekRows(events: SkyEvent[], now: Date): WeekRow[] {
  const byDay = new Map<string, SkyEvent[]>()
  for (const event of events) {
    const key = localDateKey(event.startsAt)
    const list = byDay.get(key)
    if (list) list.push(event)
    else byDay.set(key, [event])
  }

  const built = Array.from({ length: 7 }, (_, i) => {
    const dayDate = new Date(now.getTime() + i * 86_400_000)
    const dateKey = localDateKey(dayDate.toISOString())
    const weekdayLabel = dayDate.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()
    const dayLabel = dayDate.toLocaleDateString(undefined, { day: 'numeric' })

    const dayEvents = (byDay.get(dateKey) ?? []).slice().sort((a, b) => {
      const landingPriority = (event: SkyEvent) => {
        if (event.kind === 'eclipse') return 1
        if (event.kind === 'conjunction') return 2
        if (event.kind === 'planet_event') return 3
        if (event.kind === 'meteor_shower') return 4
        if (event.kind === 'moon_phase') return 5
        return metaFor(event.kind).priority + 5
      }
      const diff = landingPriority(a) - landingPriority(b)
      return diff !== 0 ? diff : a.startsAt.localeCompare(b.startsAt)
    })
    const best = dayEvents[0]

    if (best) {
      const meta = metaFor(best.kind)
      const durationHours = (new Date(best.endsAt).getTime() - new Date(best.startsAt).getTime()) / 3_600_000
      return {
        row: {
          dateKey,
          weekdayLabel,
          dayLabel,
          title: best.title,
          description: best.description || meta.reason,
          difficulty: meta.difficulty,
          timeLabel: durationHours >= 8 ? 'All night' : formatLocalTime(best.startsAt),
          isFallback: false,
        } satisfies Omit<WeekRow, 'isPick'>,
        priority: meta.priority,
      }
    }

    const evening = new Date(dayDate)
    evening.setHours(21, 0, 0, 0)
    return {
      row: {
        dateKey,
        weekdayLabel,
        dayLabel,
        title: moonPhaseNameAt(evening),
        description: `${moonPhaseNameAt(evening) === 'Full moon' ? 'The full Moon' : `A ${moonPhaseNameAt(evening).toLowerCase()} Moon`} lights the night at ${Math.round(moonIlluminationPctAt(evening))}% illumination. After dark, look for the brightest stars and any planets above your horizon.`,
        difficulty: 'easy' as TargetDifficulty,
        timeLabel: 'After dark',
        isFallback: true,
      } satisfies Omit<WeekRow, 'isPick'>,
      priority: Number.POSITIVE_INFINITY,
    }
  })

  const bestPriority = Math.min(...built.map((entry) => entry.priority))
  return built.map((entry) => ({ ...entry.row, isPick: entry.priority === bestPriority && Number.isFinite(entry.priority) }))
}

export function LandingPage({ authenticatedEmail, onEnter, onEnterPaid }: LandingPageProps) {
  const [weekRows, setWeekRows] = useState<WeekRow[] | null>(null)
  const [tonight, setTonight] = useState<TonightSnapshot | null>(null)

  useEffect(() => {
    trackEvent('Viewed landing page', { authenticated: Boolean(authenticatedEmail) })
    // Only track the initial view of this mount, not every prop change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false
    const now = new Date()

    setTonight({
      moonLabel: `${moonPhaseNameAt(now)} · ${Math.round(moonIlluminationPctAt(now))}%`,
      moonIlluminationPct: moonIlluminationPctAt(now),
      moonWaxing: isMoonWaxingAt(now),
    })

    async function loadWeek() {
      try {
        await pullSkyEvents()
        const weekEnd = new Date(now.getTime() + 7 * 86_400_000)
        const [cachedEvents, conjunctions, planetEvents] = await Promise.all([
          getEventsInRange(now, weekEnd),
          fetchConjunctionEvents({ now, windowDays: 7 }),
          fetchPlanetEvents({ now, windowDays: 7 }),
        ])
        const computedEvents: SkyEvent[] = [...conjunctions, ...planetEvents].map((event, index) => ({
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
        if (!cancelled) setWeekRows(buildWeekRows([...cachedEvents, ...computedEvents], now))
      } catch (err) {
        if (!cancelled) setWeekRows(buildWeekRows([], now))
        trackEvent('sync_failed', { stage: 'landing_week_events', error: String(err) })
      }
    }

    loadWeek()
    return () => {
      cancelled = true
    }
  }, [])

  const weekRangeLabel = useMemo(() => {
    const now = new Date()
    const end = new Date(now.getTime() + 6 * 86_400_000)
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
  const heroNote = authenticatedEmail
    ? `Signed in as ${authenticatedEmail}.`
    : `No account needed for tonight. ${SKY_PASS_SUMMARY}`

  return (
    <div className="atlas-almanac">
      <header className="am-masthead">
        <div className="am-masthead-meta">
          <span>{todayLabel}</span>
          <span>{weekRangeLabel}</span>
        </div>
        <div className="am-masthead-title">
          <div className="am-wordmark">ATLAS</div>
          <div className="am-tagline">The observer's almanac</div>
        </div>
        <nav className="am-nav" aria-label="Primary">
          <div className="am-nav-links">
            <a href="#week">This week</a>
            <a href="#membership">Membership</a>
            <a href="#ask">Questions</a>
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
              Every week the sky puts on something worth walking outside for. Atlas tells you what, and when to look up.
            </h1>
            <div className="am-lede-columns">
              <p>
                <span className="am-dropcap">A</span>tlas picks the handful of things worth looking up for each week —
                the flagship events, anywhere in the world — and tells you when they happen.
              </p>
              <p>
                Set your location and Atlas works out what is actually visible from where you stand, and what your
                eyes, binoculars or telescope can reach.
              </p>
            </div>
            <div className="am-lede-actions">
              <button type="button" className="am-btn am-btn-primary" onClick={() => handleEnter('hero')}>
                {primaryLabel}
              </button>
              <span className="am-lede-note">{heroNote}</span>
            </div>
          </div>

          <div className="am-lede-divider" aria-hidden="true" />

          <div className="am-tonight">
            <div className="am-tonight-label">Tonight</div>
            {/* The unlit disc is the base and the lit region is painted on top,
                so new moon (an empty path) and full moon (the whole disc) need
                no special cases. See lib/moonDisc.mjs for the geometry. */}
            <svg viewBox="0 0 200 120" className="am-moon-chart" role="img" aria-label={tonight ? `Moon: ${tonight.moonLabel}` : 'Moon phase'}>
              <circle cx="100" cy="60" r="42" fill="#1c1b19" />
              {tonight && (
                <path
                  d={moonLitPath({
                    cx: 100,
                    cy: 60,
                    r: 42,
                    illuminatedFraction: tonight.moonIlluminationPct / 100,
                    waxing: tonight.moonWaxing,
                  })}
                  fill="#e4dfd3"
                />
              )}
              <circle cx="100" cy="60" r="42" fill="none" stroke="#d8d2c4" strokeWidth="1" />
            </svg>
            <div className="am-tonight-stats">
              <div>
                <span>Moon</span>
                <strong>{tonight?.moonLabel ?? '—'}</strong>
              </div>
            </div>
          </div>
        </section>

        <section id="week" className="am-section am-week" aria-labelledby="am-week-title">
          <div className="am-section-head">
            <h2 id="am-week-title">Flagship events this week</h2>
            <div className="am-legend">
              {(Object.keys(GEAR_META) as TargetDifficulty[]).map((key) => (
                <span key={key} className="am-legend-item">
                  <span className="am-legend-dot" style={{ background: GEAR_META[key].color }} />
                  {GEAR_META[key].label}
                </span>
              ))}
            </div>
          </div>

          <div className="am-week-table" role="table" aria-label="This week's sky events">
            <div className="am-week-row am-week-row--head" role="row">
              <div role="columnheader">Night</div>
              <div role="columnheader">Event</div>
              <div role="columnheader">What you'll see</div>
              <div role="columnheader">Time</div>
            </div>

            {(weekRows ?? Array.from({ length: 7 })).map((row, index) => (
              <div className={`am-week-row${row && (row as WeekRow).isPick ? ' am-week-row--pick' : ''}`} role="row" key={row ? (row as WeekRow).dateKey : index}>
                {row ? (
                  <>
                    <div className="am-week-date" role="cell">
                      {(row as WeekRow).weekdayLabel} {(row as WeekRow).dayLabel}
                    </div>
                    <div className="am-week-event" role="cell">
                      <span className="am-legend-dot" style={{ background: GEAR_META[(row as WeekRow).difficulty].color }} />
                      <span className="am-week-event-title">{(row as WeekRow).title}</span>
                      {(row as WeekRow).isPick && <span className="am-pick-badge">Pick of the week</span>}
                    </div>
                    <div className="am-week-desc" role="cell">
                      {(row as WeekRow).description}
                    </div>
                    <div className="am-week-time" role="cell">
                      {(row as WeekRow).timeLabel}
                    </div>
                  </>
                ) : (
                  <div className="am-week-loading" role="cell">
                    Loading tonight's sky…
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="am-week-foot">
            <span>Global highlights, times in your own zone. Set a location and Atlas tailors the week to your sky.</span>
            <button type="button" className="am-link-btn" onClick={() => handleEnter('nav')}>
              Set your location →
            </button>
          </div>
        </section>

        <section id="membership" className="am-section am-membership" aria-labelledby="am-membership-title">
          <div className="am-section-head">
            <h2 id="am-membership-title">Membership</h2>
            <span className="am-section-note">Pay monthly, yearly, or once for life.</span>
          </div>
          <div className="am-plans">
            <div className="am-plan">
              <div className="am-plan-head">
                <span>The Almanac</span>
                <span>Free</span>
              </div>
              <ul>
                <li>Tonight's plan for your location, no account needed</li>
                <li>14-day event browsing</li>
                <li>Check-ins on what you saw</li>
                <li>A private observing journal</li>
              </ul>
              <button type="button" className="am-btn am-btn-outline" onClick={() => handleEnter('membership-free')}>
                {primaryLabel}
              </button>
            </div>
            <div className="am-plan-divider" />
            <div className="am-plan am-plan--paid">
              <div className="am-plan-head">
                <span>Sky Pass</span>
              </div>
              <ul className="am-plan-tiers">
                {SKY_PASS_TIERS.map((tier) => (
                  <li key={tier.id}>
                    <span>{tier.label}</span>
                    <span>{tier.price}</span>
                  </li>
                ))}
              </ul>
              <ul>
                <li>90-day forward planning</li>
                <li>Saved targets &amp; reminders</li>
                <li>Dark-sky trip planner</li>
                <li>Camera &amp; lens exposure notes</li>
                <li>Community feed &amp; archive</li>
              </ul>
              <button type="button" className="am-btn am-btn-primary" onClick={() => handleEnter('membership-paid')}>
                Get Sky Pass
              </button>
            </div>
          </div>
        </section>

        <section id="ask" className="am-section am-faq" aria-labelledby="am-faq-title">
          <div className="am-section-head">
            <h2 id="am-faq-title">Questions from readers</h2>
          </div>
          <div className="am-faq-grid">
            {FAQS.map((faq) => (
              <details className="am-faq-item" key={faq.q}>
                <summary>
                  <span>{faq.q}</span>
                  <span className="am-faq-sign" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p>{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

      </main>

      <footer className="am-colophon">
        <div className="am-colophon-grid">
          <div className="am-colophon-brand">
            <div className="am-wordmark am-wordmark--small">ATLAS</div>
            <p>Compiled from public ephemerides, live weather forecasts and a world map of night-sky brightness.</p>
            <button type="button" className="am-btn am-btn-outline" onClick={() => handleEnter('footer')}>
              {primaryLabel}
            </button>
          </div>
          <div className="am-colophon-col">
            <span>The app</span>
            <a href="#week">This week</a>
            <a href="#membership">Membership</a>
            <a href="#ask">Questions</a>
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
