import { useEffect, useMemo, useState } from 'react'
import { trackEvent } from '../lib/analytics'
import { pullSkyEvents, getEventsInRange } from '../lib/sync'
import type { SkyEvent } from '../lib/db'
import { metaFor, type TargetDifficulty } from '../lib/tonightTargets'
import { bodyForTarget, getHorizontalPosition } from '../lib/skyPosition'
import { getDarknessWindow } from '../lib/darknessWindow'
import { moonIlluminationPctAt, moonPhaseNameAt } from '../lib/moonPhase'
import { localDateKey, fetchViewingForecast, type DailyViewingAdvisory } from '../lib/weather'
import { estimateLightPollution, rankDarkSkySites, skyQualityLabelForScore, type RankedDarkSkySite } from '../lib/darkSky'
import type { CurrentLocation } from '../lib/currentLocation'

interface LandingPageProps {
  authenticatedEmail?: string
  city: CurrentLocation
  onEnter: () => void
}

type CtaSource = 'nav' | 'hero' | 'membership-free' | 'membership-paid' | 'final' | 'footer'

interface WeekRow {
  dateKey: string
  weekdayLabel: string
  dayLabel: string
  title: string
  description: string
  difficulty: TargetDifficulty
  timeLabel: string
  windowStartPct: number
  windowWidthPct: number
  isPick: boolean
  isFallback: boolean
}

interface TonightSnapshot {
  darkFromLabel: string
  moonLabel: string
  moonIlluminationPct: number
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
    q: 'How does it know what I like?',
    a: 'From what you mark as seen, what you skip, and the gear you tell it you own. Nothing you log leaves your account.',
  },
  {
    q: 'Is this an app or a website?',
    a: 'A website that works offline once it has loaded, and installs to your home screen like an app.',
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

function formatCoord(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S'
  const lonDir = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(2)}°${latDir} ${Math.abs(lon).toFixed(2)}°${lonDir}`
}

function formatLocalTime(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone })
}

// Position within the 18:00 - 06:00 "usable night" window, as a 0-1
// fraction, for drawing the ephemeris table's visibility bar.
function nightWindowFraction(iso: string, timeZone?: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric', hourCycle: 'h23', timeZone }).formatToParts(
    new Date(iso),
  )
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
  const decimalHour = hour + minute / 60
  const hoursSince18 = decimalHour >= 18 ? decimalHour - 18 : decimalHour + 6
  return Math.min(1, Math.max(0, hoursSince18 / 12))
}

function buildWeekRows(events: SkyEvent[], city: CurrentLocation, now: Date): WeekRow[] {
  const byDay = new Map<string, SkyEvent[]>()
  for (const event of events) {
    const key = localDateKey(event.startsAt, city.timeZone)
    const list = byDay.get(key)
    if (list) list.push(event)
    else byDay.set(key, [event])
  }

  const built = Array.from({ length: 7 }, (_, i) => {
    const dayDate = new Date(now.getTime() + i * 86_400_000)
    const dateKey = localDateKey(dayDate.toISOString(), city.timeZone)
    const weekdayLabel = dayDate.toLocaleDateString(undefined, { weekday: 'short', timeZone: city.timeZone }).toUpperCase()
    const dayLabel = dayDate.toLocaleDateString(undefined, { day: 'numeric', timeZone: city.timeZone })

    const dayEvents = (byDay.get(dateKey) ?? []).slice().sort((a, b) => {
      const diff = metaFor(a.kind).priority - metaFor(b.kind).priority
      return diff !== 0 ? diff : a.startsAt.localeCompare(b.startsAt)
    })
    const best = dayEvents[0]

    if (best) {
      const meta = metaFor(best.kind)
      const durationHours = (new Date(best.endsAt).getTime() - new Date(best.startsAt).getTime()) / 3_600_000
      const allNight = durationHours >= 8
      const body = bodyForTarget(best.kind, best.target)
      const compass = body ? getHorizontalPosition(body, new Date(best.startsAt), city.lat, city.lon).compassLabel : null
      const timeLabel = allNight ? 'All night' : [formatLocalTime(best.startsAt, city.timeZone), compass].filter(Boolean).join(' · ')
      const startFraction = allNight ? 0.04 : nightWindowFraction(best.startsAt, city.timeZone)
      const endFraction = allNight ? 0.96 : Math.max(startFraction + 0.04, nightWindowFraction(best.endsAt, city.timeZone))
      return {
        row: {
          dateKey,
          weekdayLabel,
          dayLabel,
          title: best.title,
          description: best.description || meta.reason,
          difficulty: meta.difficulty,
          timeLabel,
          windowStartPct: startFraction * 100,
          windowWidthPct: Math.max(4, (endFraction - startFraction) * 100),
          isFallback: false,
        } satisfies Omit<WeekRow, 'isPick'>,
        priority: meta.priority,
      }
    }

    const evening = new Date(dayDate)
    evening.setHours(21, 0, 0, 0)
    const illuminationPct = Math.round(moonIlluminationPctAt(evening))
    const phase = moonPhaseNameAt(evening)
    return {
      row: {
        dateKey,
        weekdayLabel,
        dayLabel,
        title: `${phase} over ${city.name}`,
        description: `No standout scheduled event here tonight — the Moon is ${illuminationPct}% illuminated. Check the sky map for planets and satellite passes.`,
        difficulty: 'easy' as TargetDifficulty,
        timeLabel: 'After dark',
        windowStartPct: 20,
        windowWidthPct: 60,
        isFallback: true,
      } satisfies Omit<WeekRow, 'isPick'>,
      priority: Number.POSITIVE_INFINITY,
    }
  })

  const bestPriority = Math.min(...built.map((entry) => entry.priority))
  return built.map((entry) => ({ ...entry.row, isPick: entry.priority === bestPriority && Number.isFinite(entry.priority) }))
}

export function LandingPage({ authenticatedEmail, city, onEnter }: LandingPageProps) {
  const [weekRows, setWeekRows] = useState<WeekRow[] | null>(null)
  const [tonight, setTonight] = useState<TonightSnapshot | null>(null)
  const [forecastDays, setForecastDays] = useState<DailyViewingAdvisory[] | null>(null)
  const [nearestSite, setNearestSite] = useState<RankedDarkSkySite | null>(null)

  useEffect(() => {
    trackEvent('Viewed landing page', { authenticated: Boolean(authenticatedEmail) })
    // Only track the initial view of this mount, not every prop change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false
    const now = new Date()

    const darkness = getDarknessWindow(city.lat, city.lon, now, new Date(now.getTime() + 2 * 86_400_000))
    const darkFromIso = darkness.astronomicalDuskAt ?? darkness.civilDuskAt ?? darkness.sunsetAt
    setTonight({
      darkFromLabel: darkFromIso ? formatLocalTime(darkFromIso, city.timeZone) : '—',
      moonLabel: `${moonPhaseNameAt(now)} · ${Math.round(moonIlluminationPctAt(now))}%`,
      moonIlluminationPct: moonIlluminationPctAt(now),
    })
    setNearestSite(rankDarkSkySites(city.lat, city.lon, 1)[0] ?? null)

    async function loadWeek() {
      try {
        await pullSkyEvents()
        const end = new Date(now.getTime() + 7 * 86_400_000)
        const events = await getEventsInRange(now, end)
        if (!cancelled) setWeekRows(buildWeekRows(events, city, now))
      } catch (err) {
        if (!cancelled) setWeekRows(buildWeekRows([], city, now))
        trackEvent('sync_failed', { stage: 'landing_week_events', error: String(err) })
      }
    }

    async function loadForecast() {
      try {
        const forecast = await fetchViewingForecast(city.lat, city.lon, 7)
        if (!cancelled) setForecastDays(forecast.days)
      } catch (err) {
        trackEvent('sync_failed', { stage: 'landing_forecast', error: String(err) })
      }
    }

    loadWeek()
    loadForecast()
    return () => {
      cancelled = true
    }
  }, [city])

  const skyGlow = useMemo(() => estimateLightPollution(city.lat, city.lon), [city.lat, city.lon])
  const weekRangeLabel = useMemo(() => {
    const now = new Date()
    const end = new Date(now.getTime() + 6 * 86_400_000)
    const start = now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })
    const endLabel = end.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long' })
    return `${start} — ${endLabel}`
  }, [])
  const todayLabel = useMemo(() => new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }), [])
  const pickRow = weekRows?.find((row) => row.isPick && !row.isFallback) ?? null

  function handleEnter(source: CtaSource) {
    trackEvent('Landing CTA clicked', { method: authenticatedEmail ? 'open_app' : 'get_started', source })
    onEnter()
  }

  const primaryLabel = authenticatedEmail ? 'Open Atlas' : 'Get started'
  const finalLabel = authenticatedEmail ? 'Return to Atlas' : 'See this week’s sky'
  const heroNote = authenticatedEmail
    ? `Signed in as ${authenticatedEmail}.`
    : 'Free to start. Sky Pass is a one-time £24 upgrade, never a subscription.'

  return (
    <div className="atlas-almanac">
      <header className="am-masthead">
        <div className="am-masthead-meta">
          <span>{todayLabel}</span>
          <span className="am-masthead-meta-location">
            {city.name}
            <span className="am-masthead-coords"> &middot; {formatCoord(city.lat, city.lon)}</span>
          </span>
          <span>{weekRangeLabel}</span>
        </div>
        <div className="am-masthead-title">
          <div className="am-wordmark">ATLAS</div>
          <div className="am-tagline">The observer's almanac</div>
        </div>
        <nav className="am-nav" aria-label="Primary">
          <div className="am-nav-links">
            <a href="#week">This week</a>
            <a href="#how">How it works</a>
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
                <span className="am-dropcap">A</span>tlas reads the sky above your address — the moon, the weather, how much
                light your street throws up — and picks the handful of things that are genuinely visible from where you
                stand this week.
              </p>
              <p>
                Nothing on the list needs equipment you don't own. Tell it whether you have eyes, binoculars or a
                telescope, and the entries you can't use quietly drop away.
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
            <div className="am-tonight-label">Tonight over {city.name}</div>
            <svg viewBox="0 0 200 120" className="am-moon-chart" role="img" aria-label={tonight ? `Moon: ${tonight.moonLabel}` : 'Moon phase'}>
              <defs>
                <clipPath id="am-moon-clip">
                  <circle cx="100" cy="60" r="42" />
                </clipPath>
              </defs>
              <circle cx="100" cy="60" r="42" fill="#e4dfd3" />
              {tonight && (
                <ellipse
                  cx={100 + (84 * (0.5 - tonight.moonIlluminationPct / 100))}
                  cy="60"
                  rx="42"
                  ry="42"
                  fill="#1c1b19"
                  clipPath="url(#am-moon-clip)"
                />
              )}
              <circle cx="100" cy="60" r="42" fill="none" stroke="#d8d2c4" strokeWidth="1" />
            </svg>
            <div className="am-tonight-stats">
              <div>
                <span>Dark from</span>
                <strong>{tonight?.darkFromLabel ?? '—'}</strong>
              </div>
              <div>
                <span>Moon</span>
                <strong>{tonight?.moonLabel ?? '—'}</strong>
              </div>
              <div>
                <span>Sky glow</span>
                <strong>
                  Bortle {skyGlow.bortleClass} · {skyQualityLabelForScore(skyGlow.skyQualityScore)}
                </strong>
              </div>
              <div>
                <span>Nearest dark sky</span>
                <strong>{nearestSite ? `${nearestSite.estimatedTravelMinutes} min` : '—'}</strong>
              </div>
            </div>
          </div>
        </section>

        <section id="week" className="am-section am-week" aria-labelledby="am-week-title">
          <div className="am-section-head">
            <h2 id="am-week-title">Ephemeris for the week</h2>
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
              <div role="columnheader">Best time</div>
              <div role="columnheader">Visible window · 18h — 06h</div>
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
                    <div role="cell">
                      <div className="am-week-bar-track">
                        <span
                          className="am-week-bar-fill"
                          style={{
                            left: `${(row as WeekRow).windowStartPct}%`,
                            width: `${(row as WeekRow).windowWidthPct}%`,
                            background: GEAR_META[(row as WeekRow).difficulty].color,
                          }}
                        />
                      </div>
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
            <span>Times shown for {city.name}. Atlas recalculates this whole table for wherever you are.</span>
            <button type="button" className="am-link-btn" onClick={() => handleEnter('nav')}>
              Set your location →
            </button>
          </div>
        </section>

        <section id="how" className="am-section am-how" aria-labelledby="am-how-title">
          <div className="am-section-head">
            <h2 id="am-how-title">How the almanac is made</h2>
          </div>
          <div className="am-how-grid">
            <div className="am-how-step">
              <div className="am-how-step-head">
                <span className="am-how-numeral" style={{ color: '#5b87a8' }}>
                  I
                </span>
                <span>Say where you stand</span>
              </div>
              <p>
                An address is enough. Atlas works out your light pollution, your horizon and the weather rolling in,
                then throws out everything that won't clear your neighbour's roof.
              </p>
            </div>
            <div className="am-how-divider" />
            <div className="am-how-step">
              <div className="am-how-step-head">
                <span className="am-how-numeral" style={{ color: '#7ea888' }}>
                  II
                </span>
                <span>Say what you look through</span>
              </div>
              <p>
                Nothing is aspirational. Entries are written for the instrument you actually own, down to how to hold
                it steady, and a beginner's week never opens with something they'd fail to find.
              </p>
            </div>
            <div className="am-how-divider" />
            <div className="am-how-step">
              <div className="am-how-step-head">
                <span className="am-how-numeral" style={{ color: '#c4685c' }}>
                  III
                </span>
                <span>Go out, log it, get better</span>
              </div>
              <p>
                Mark what you saw and Atlas keeps a private journal of it. Photographers get exposure notes for that
                object at that altitude, and a nudge when a trip is worth the drive.
              </p>
            </div>
          </div>
        </section>

        <section className="am-strip" aria-label="This week at a glance">
          <div className="am-strip-item">
            <div className="am-strip-label">Nearest dark sky</div>
            <div className="am-strip-value">{nearestSite ? `${nearestSite.name}` : 'Finding one for you…'}</div>
            <div className="am-strip-sub">
              {nearestSite ? `Bortle ${nearestSite.bortleClass} · ${Math.round(nearestSite.distanceKm)} km, about ${nearestSite.estimatedTravelMinutes} min` : ''}
            </div>
          </div>
          <div className="am-strip-divider" />
          <div className="am-strip-item">
            <div className="am-strip-label">Pick of the week</div>
            <div className="am-strip-value">{pickRow ? pickRow.title : 'Checking the sky…'}</div>
            <div className="am-strip-sub">{pickRow ? `${pickRow.weekdayLabel} ${pickRow.dayLabel} · ${pickRow.timeLabel}` : 'Atlas is scanning the whole week.'}</div>
          </div>
          <div className="am-strip-divider" />
          <div className="am-strip-item">
            <div className="am-strip-label">This week's forecast</div>
            <div className="am-forecast-bars">
              {(forecastDays ?? Array.from({ length: 7 })).map((day, index) => {
                const advisory = day as DailyViewingAdvisory | undefined
                const clearPct = advisory ? Math.max(6, 100 - advisory.cloudCoverPct) : 6
                const label = advisory
                  ? new Date(`${advisory.date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'narrow' })
                  : '·'
                return (
                  <span className="am-forecast-bar" key={advisory?.date ?? index}>
                    <span
                      className="am-forecast-bar-fill"
                      style={{ height: `${clearPct}%`, background: advisory?.quality === 'cloudy' ? '#4d6150' : '#7ea888' }}
                    />
                    <span className="am-forecast-bar-label">{label}</span>
                  </span>
                )
              })}
            </div>
            <div className="am-strip-sub">Clear-sky chance, per night</div>
          </div>
        </section>

        <section id="membership" className="am-section am-membership" aria-labelledby="am-membership-title">
          <div className="am-section-head">
            <h2 id="am-membership-title">Membership</h2>
            <span className="am-section-note">One purchase. No recurring charge.</span>
          </div>
          <div className="am-plans">
            <div className="am-plan">
              <div className="am-plan-head">
                <span>The Almanac</span>
                <span>Free</span>
              </div>
              <ul>
                <li>Tonight's plan for your location</li>
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
                <span>£24 once</span>
              </div>
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

        <section className="am-final" aria-labelledby="am-final-title">
          <h2 id="am-final-title">Find your reason to step outside.</h2>
          <p>Free to start. Sky Pass is a one-time upgrade when you want the rest.</p>
          <button type="button" className="am-btn am-btn-primary" onClick={() => handleEnter('final')}>
            {finalLabel}
          </button>
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
            <a href="#how">How it works</a>
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
