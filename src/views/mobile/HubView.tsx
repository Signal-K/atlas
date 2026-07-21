import { useEffect, useRef, useState } from 'react'
import { SkyMapCanvas } from '../../components/SkyMapCanvas'
import { SkyMapOverlay } from '../../components/SkyMapOverlay'
import { getTonightPlan, type TonightPlan } from '../../lib/tonightTargets'
import { fetchViewingAdvisory, type DailyViewingAdvisory } from '../../lib/weather'
import { pullSkyEvents } from '../../lib/sync'
import { formatWatchValue, getWatchlist, type WatchlistItem } from '../../lib/watchlist'
import { listGetReadyReminders, scheduleStoredReminders, type GetReadyReminder } from '../../lib/getReadyReminders'
import { turnInstruction, useDeviceCompass } from '../../lib/deviceCompass'
import type { CurrentLocation } from '../../lib/currentLocation'
import type { MobileTab } from '../../components/MobileShell'
import { CAMERA_PROFILES, getDefaultDevice } from '../../lib/cameraProfiles'
import { recipeKeyForEventKind } from '../../lib/cameraRecipes'
import { trackEvent } from '../../lib/analytics'
import { estimateLightPollution } from '../../lib/darkSky'
import {
  describeWhatYouWouldSee,
  dismissEquipmentPrompt,
  EQUIPMENT_OPTIONS,
  equipmentFitNote,
  getEquipmentChoice,
  recordLocalTargetTap,
  saveEquipmentChoice,
  shouldAskForEquipment,
  sortTargetsByEquipment,
  type EquipmentChoice,
} from '../../lib/firstPlanJourney'
import type { ObservationDraft } from '../../lib/observationDraft'

interface HubViewProps {
  city: CurrentLocation
  onOpenTab: (tab: MobileTab) => void
  onLogAttempt: (draft: ObservationDraft) => void
}

type HubIconName = 'target' | 'cloud' | 'moon' | 'clock' | 'sun' | 'spark' | 'eye' | 'bell' | 'chevron'

function HubIcon({ name }: { name: HubIconName }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  if (name === 'target') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="7" />
        <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    )
  }
  if (name === 'cloud') {
    return (
      <svg {...common}>
        <path d="M7 18h10a4 4 0 0 0 .4-8 6 6 0 0 0-11.2 1.7A3.2 3.2 0 0 0 7 18Z" />
      </svg>
    )
  }
  if (name === 'moon') {
    return (
      <svg {...common}>
        <path d="M18.5 15.5A7 7 0 0 1 8.5 5.5 8 8 0 1 0 18.5 15.5Z" />
      </svg>
    )
  }
  if (name === 'clock') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 7v5l3 2" />
      </svg>
    )
  }
  if (name === 'sun') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 2.5v2M12 19.5v2M4.8 4.8l1.4 1.4M17.8 17.8l1.4 1.4M2.5 12h2M19.5 12h2M4.8 19.2l1.4-1.4M17.8 6.2l1.4-1.4" />
      </svg>
    )
  }
  if (name === 'eye') {
    return (
      <svg {...common}>
        <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" />
        <circle cx="12" cy="12" r="2.5" />
      </svg>
    )
  }
  if (name === 'bell') {
    return (
      <svg {...common}>
        <path d="M7 10a5 5 0 0 1 10 0c0 5 2 6 2 6H5s2-1 2-6Z" />
        <path d="M10 19a2.2 2.2 0 0 0 4 0" />
      </svg>
    )
  }
  if (name === 'chevron') {
    return (
      <svg {...common}>
        <path d="M9 5l7 7-7 7" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M12 3l1.5 5 5 .5-4 3.1 1.2 5-3.7-2.6-3.7 2.6 1.2-5-4-3.1 5-.5L12 3Z" />
    </svg>
  )
}

function formatTime(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone })
}

const KIND_KICKER: Record<string, { label: string; color: string }> = {
  moon_phase: { label: 'MOON', color: 'var(--dt-glacier-400)' },
  eclipse: { label: 'ECLIPSE', color: 'var(--dt-glacier-400)' },
  iss_pass: { label: 'ORBIT PASS', color: 'var(--dt-moss-400)' },
  satellite_flare: { label: 'ORBIT PASS', color: 'var(--dt-moss-400)' },
  conjunction: { label: 'CONJUNCTION', color: 'var(--dt-plum-400)' },
  planet_event: { label: 'PLANET', color: 'var(--dt-plum-400)' },
  meteor_shower: { label: 'TIMED', color: 'var(--dt-rust-400)' },
  comet: { label: 'COMET', color: 'var(--dt-rust-400)' },
  deep_sky: { label: 'DEEP SKY', color: 'var(--dt-plum-400)' },
  aurora: { label: 'AURORA', color: 'var(--dt-solar-400)' },
}

function kickerFor(kind: string): { label: string; color: string } {
  return KIND_KICKER[kind] ?? { label: 'SKY EVENT', color: 'var(--dt-primary)' }
}

export function HubView({ city, onOpenTab, onLogAttempt }: HubViewProps) {
  const [plan, setPlan] = useState<TonightPlan | null>(null)
  const [advisory, setAdvisory] = useState<DailyViewingAdvisory | null>(null)
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [reminders, setReminders] = useState<GetReadyReminder[]>(() => listGetReadyReminders())
  const [mapOpen, setMapOpen] = useState(false)
  const [expandedTargetId, setExpandedTargetId] = useState<string | null>(null)
  const [equipment, setEquipment] = useState<EquipmentChoice | null>(() => getEquipmentChoice())
  const [showEquipmentPrompt, setShowEquipmentPrompt] = useState(() => shouldAskForEquipment())
  const trackedFeedLoadRef = useRef<string | null>(null)
  const compass = useDeviceCompass()

  useEffect(() => {
    let cancelled = false
    async function load() {
      await pullSkyEvents()
      const [tonightPlan, advisoryDays, watched] = await Promise.all([
        getTonightPlan(city.lat, city.lon, new Date(), city.timeZone),
        fetchViewingAdvisory(city.lat, city.lon, 1).catch(() => []),
        getWatchlist(),
      ])
      if (cancelled) return
      setPlan(tonightPlan)
      setAdvisory(advisoryDays[0] ?? null)
      setWatchlist(watched)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [city])

  useEffect(() => {
    if (!plan || trackedFeedLoadRef.current === city.name) return
    trackedFeedLoadRef.current = city.name
    trackEvent('Viewed Tonight page', { city: city.name, surface: 'mobile_hub' })
  }, [city.name, plan])

  useEffect(() => {
    scheduleStoredReminders()
    function refreshReminders() {
      setReminders(listGetReadyReminders())
    }
    window.addEventListener('atlas:get-ready-reminders-changed', refreshReminders)
    window.addEventListener('storage', refreshReminders)
    return () => {
      window.removeEventListener('atlas:get-ready-reminders-changed', refreshReminders)
      window.removeEventListener('storage', refreshReminders)
    }
  }, [])

  if (!plan) {
    return <div className="mobile-hub-loading">Loading tonight&rsquo;s sky&hellip;</div>
  }

  const rankedTargets = sortTargetsByEquipment(plan.targets, equipment)
  const topTarget = rankedTargets[0]
  const sunsetAt = plan.darknessWindow.civilDuskAt
  const darkAt = plan.darknessWindow.astronomicalDuskAt
  const cloudCover = advisory ? `${Math.round(advisory.cloudCoverPct)}%` : '—'
  const visibility = advisory ? formatWatchValue(advisory.quality) : '—'
  const moon = `${Math.round(plan.moonIlluminationPct)}%`
  const lightPollution = estimateLightPollution(city.lat, city.lon)
  const clarity = advisory ? Math.max(0, 100 - advisory.cloudCoverPct) : 70
  const targetDirection = topTarget?.direction
  const turnHint =
    compass.headingDeg != null && targetDirection ? turnInstruction(compass.headingDeg, targetDirection.azimuthDeg) : 'Enable compass'

  function expandTarget(target: TonightPlan['targets'][number]) {
    recordLocalTargetTap(target, 'mobile_hub', city.name)
    trackEvent('Tapped visible target', { targetId: target.eventId, title: target.title, kind: target.kind, source: 'mobile_hub' })
    setExpandedTargetId((current) => (current === target.eventId ? null : target.eventId))
    if (!equipment && shouldAskForEquipment()) setShowEquipmentPrompt(true)
  }

  function chooseEquipment(choice: EquipmentChoice) {
    saveEquipmentChoice(choice)
    setEquipment(choice)
    setShowEquipmentPrompt(false)
    trackEvent('Answered equipment prompt', { choice, source: 'mobile_hub' })
  }

  function skipEquipment() {
    dismissEquipmentPrompt()
    setShowEquipmentPrompt(false)
    trackEvent('Skipped equipment prompt', { source: 'mobile_hub' })
  }

  return (
    <div className="dt-hub dt-starfield-bg">
      {/* BRIEFING */}
      <section>
        <div className="dt-briefing-head">
          <div>
            <span className="dt-kicker">
              <span className="dt-kicker-dot dt-pulse" />
              {plan.rating === 'skip' ? 'HOLD FOR CLEAR SKIES' : 'ACTIVE RESEARCH'}
            </span>
            <h2 className="dt-h2">{plan.rating === 'skip' ? 'Hold for a better window.' : 'Tonight is live.'}</h2>
          </div>
          <button type="button" className="dt-icon-btn" onClick={() => onOpenTab('events')} aria-label="Open events">
            <HubIcon name="chevron" />
          </button>
        </div>

        <button type="button" className="dt-bracket dt-map-preview" onClick={() => setMapOpen(true)} aria-label="Open full sky map">
          <span className="dt-bc-tr" />
          <span className="dt-bc-bl" />
          <div className="sky-map-frame sky-map-frame--hub">
            <SkyMapCanvas
              clarity={clarity}
              date={new Date()}
              lat={city.lat}
              lon={city.lon}
              markerLabel={topTarget?.title}
              markerPosition={topTarget?.direction}
              presentation="full"
            />
          </div>
          <span className="dt-map-preview-label" style={{ position: 'relative', zIndex: 1 }}>
            Tap for full sky map
          </span>
        </button>
        <div className="dt-map-readout">
          <span>LAT {city.lat.toFixed(2)}</span>
          <span>LON {city.lon.toFixed(2)}</span>
          <span>{targetDirection ? `${targetDirection.compassLabel} ${Math.round(targetDirection.altitudeDeg)}° ALT` : 'NO TARGET'}</span>
        </div>

        <div className="dt-pointing-row">
          <div>
            <span className="dt-eyebrow">Phone pointing</span>
            <strong>{compass.status === 'active' ? turnHint : compass.status === 'denied' ? 'Permission denied' : 'Compass idle'}</strong>
            {compass.status === 'active' && (
              <small>{compass.headingDeg == null ? 'Move phone to calibrate' : `${Math.round(compass.headingDeg)}° heading`}</small>
            )}
          </div>
          {compass.status !== 'active' && (
            <button type="button" onClick={compass.enable} disabled={compass.status === 'unsupported'}>
              {compass.status === 'unsupported' ? 'Unavailable' : 'Enable'}
            </button>
          )}
        </div>

        <div className="dt-widget-grid">
          <div className="dt-widget-cell dt-widget-cell--wide">
            <span className="dt-widget-eyebrow"><HubIcon name="target" />Next up</span>
            <span className="dt-widget-value">{topTarget ? topTarget.title : 'No local target'}</span>
            <span className="dt-widget-caption">{topTarget ? formatTime(topTarget.bestTime, plan.timeZone) : 'Check again later'}</span>
          </div>
          <div className="dt-widget-cell">
            <span className="dt-widget-eyebrow"><HubIcon name="cloud" />Cloud</span>
            <span className="dt-widget-value">{cloudCover}</span>
            <span className="dt-widget-caption">{visibility}</span>
          </div>
          <div className="dt-widget-cell">
            <span className="dt-widget-eyebrow"><HubIcon name="moon" />Moon</span>
            <span className="dt-widget-value">{moon}</span>
            <span className="dt-widget-caption">illumination</span>
          </div>
          <div className="dt-widget-cell">
            <span className="dt-widget-eyebrow"><HubIcon name="clock" />Dark</span>
            <span className="dt-widget-value">{darkAt ? formatTime(darkAt, plan.timeZone) : '—'}</span>
            <span className="dt-widget-caption">astro dusk</span>
          </div>
          <div className="dt-widget-cell">
            <span className="dt-widget-eyebrow"><HubIcon name="sun" />Sunset</span>
            <span className="dt-widget-value">{sunsetAt ? formatTime(sunsetAt, plan.timeZone) : '—'}</span>
            <span className="dt-widget-caption">{city.name}</span>
          </div>
          <div className="dt-widget-cell">
            <span className="dt-widget-eyebrow"><HubIcon name="spark" />Light</span>
            <span className="dt-widget-value">Bortle {lightPollution.bortleClass}</span>
            <span className="dt-widget-caption">{lightPollution.label}</span>
          </div>
        </div>
      </section>

      {mapOpen && (
        <SkyMapOverlay
          cityName={city.name}
          clarity={clarity}
          lat={city.lat}
          lon={city.lon}
          targetLabel={topTarget?.title}
          targetPosition={topTarget?.direction}
          compassStatus={compass.status}
          pointing={compass.pointing}
          onEnableCompass={compass.enable}
          onClose={() => setMapOpen(false)}
        />
      )}

      {topTarget && (
        <>
          <div className="dt-stitch" />
          <section>
            <div className="dt-section-eyebrow">After observing</div>
            <button
              type="button"
              className="dt-primary-btn"
              onClick={() =>
                onLogAttempt({
                  eventId: topTarget.eventId,
                  targetName: topTarget.title,
                  deviceUsed: CAMERA_PROFILES[getDefaultDevice()].name,
                  cameraRecipeUsed: recipeKeyForEventKind(topTarget.kind) ?? undefined,
                  locationLabel: city.name,
                })
              }
            >
              Log attempt
            </button>
          </section>
        </>
      )}

      <div className="dt-stitch" />

      {showEquipmentPrompt && (
        <section className="dt-equipment-prompt">
          <div>
            <span className="dt-section-eyebrow">Equipment</span>
            <h3>What do you have with you?</h3>
            <p>Atlas will tune tonight&apos;s targets and camera tips from here.</p>
          </div>
          <div className="dt-equipment-options">
            {EQUIPMENT_OPTIONS.map((option) => (
              <button type="button" key={option.id} onClick={() => chooseEquipment(option.id)}>
                {option.label}
              </button>
            ))}
          </div>
          <button type="button" className="dt-equipment-skip" onClick={skipEquipment}>
            Skip for now
          </button>
        </section>
      )}

      {showEquipmentPrompt && <div className="dt-stitch" />}

      {/* TONIGHT'S EVENTS */}
      <section>
        <div className="dt-section-head">
          <span className="dt-section-eyebrow"><HubIcon name="spark" />Tonight&rsquo;s events</span>
          <button type="button" className="dt-chevron-btn" onClick={() => onOpenTab('events')} aria-label="View all events">
            <HubIcon name="chevron" />
          </button>
        </div>
        {plan.targets.length === 0 ? (
          <p className="dt-empty-hint">
            {plan.rating === 'skip' ? 'Nothing worth going outside for tonight.' : 'No events cached yet — try again once online.'}
          </p>
        ) : (
          <>
            <div className="dt-today-rule">
              <span>TODAY</span>
              <span />
            </div>
            {rankedTargets.slice(0, 3).map((target) => {
              const kicker = kickerFor(target.kind)
              const expanded = expandedTargetId === target.eventId
              return (
                <div key={target.eventId} className="dt-feed-row-wrap">
                  <button type="button" className="dt-feed-row" onClick={() => expandTarget(target)} aria-expanded={expanded}>
                    <div className="dt-feed-row-top">
                      <span className="dt-feed-kicker" style={{ color: kicker.color }}>
                        <span className="dt-dot" />
                        {kicker.label}
                      </span>
                      <span className="dt-feed-time">{formatTime(target.bestTime, plan.timeZone)}</span>
                    </div>
                    <div className="dt-feed-headline-row">
                      <span className="dt-feed-headline">{target.title}</span>
                      <span className="dt-feed-chevron">{expanded ? '−' : '+'}</span>
                    </div>
                    <span className="dt-feed-meta">
                      {target.direction ? `${target.direction.compassLabel}, ${Math.round(target.direction.altitudeDeg)}° up` : 'Direction varies'} ·{' '}
                      {target.nakedEyeVisible ? 'naked-eye' : 'needs binoculars or a scope'}
                    </span>
                  </button>
                  {expanded && (
                    <div className="dt-feed-preview">
                      <p>{describeWhatYouWouldSee(target)}</p>
                      <p className="dt-feed-equipment-note">{target.viewingNote}</p>
                      {equipmentFitNote(target, equipment) && <p className="dt-feed-equipment-note">{equipmentFitNote(target, equipment)}</p>}
                      <button type="button" onClick={() => onOpenTab('events')}>
                        Open details
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </section>

      <div className="dt-stitch" />

      {/* WATCHLIST */}
      <section>
        <div className="dt-section-head">
          <span className="dt-section-eyebrow"><HubIcon name="eye" />Watchlist</span>
          <button type="button" className="dt-chevron-btn" onClick={() => onOpenTab('calendar')} aria-label="Open plan">
            <HubIcon name="chevron" />
          </button>
        </div>
        {watchlist.length === 0 ? (
          <p className="dt-empty-hint">Nothing watched yet. Add targets from Events.</p>
        ) : (
          <div className="dt-watch-grid">
            {watchlist.slice(0, 4).map((item) => (
              <button type="button" className="dt-watch-cell" key={`${item.kind}:${item.value}`} onClick={() => onOpenTab('calendar')}>
                <HubIcon name="eye" />
                <strong>{formatWatchValue(item.value)}</strong>
                <small>{formatWatchValue(item.kind)}</small>
              </button>
            ))}
          </div>
        )}
      </section>

      {reminders.length > 0 && (
        <>
          <div className="dt-stitch" />
          <section style={{ paddingBottom: 8 }}>
            <div className="dt-section-head">
              <span className="dt-section-eyebrow">Get ready</span>
              <button type="button" className="dt-chevron-btn" onClick={() => onOpenTab('calendar')} aria-label="Open plan">
                <HubIcon name="chevron" />
              </button>
            </div>
            {reminders.slice(0, 2).map((reminder) => (
              <button type="button" key={reminder.id} className="dt-feed-row dt-reminder-row" onClick={() => onOpenTab('calendar')}>
                <HubIcon name="bell" />
                <span className="dt-reminder-title">{reminder.title}</span>
                <span className="dt-feed-time">
                  {formatTime(reminder.remindAt)} · {reminder.deviceName}
                </span>
              </button>
            ))}
          </section>
        </>
      )}
    </div>
  )
}
