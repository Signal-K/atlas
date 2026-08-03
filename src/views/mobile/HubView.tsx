import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import '../../mobile.css'
import { SkyMapCanvas } from '../../components/SkyMapCanvas'
import { SkyMapOverlay } from '../../components/SkyMapOverlay'
import { getTonightPlan, type TonightPlan } from '../../lib/tonightTargets'
import { fetchViewingAdvisory, fetchViewingForecast, type DailyViewingAdvisory } from '../../lib/weather'
import { getUpcomingEvents, pullSkyEvents } from '../../lib/sync'
import { formatWatchValue, getWatchlist, type WatchlistItem } from '../../lib/watchlist'
import { listGetReadyReminders, scheduleStoredReminders, type GetReadyReminder } from '../../lib/getReadyReminders'
import { turnInstruction, useDeviceCompass } from '../../lib/deviceCompass'
import type { CurrentLocation } from '../../lib/currentLocation'
import type { MobileTab } from '../../components/MobileShell'
import { CAMERA_PROFILES, getDefaultDevice } from '../../lib/cameraProfiles'
import { CAMERA_RECIPES, TRIPOD_HANDHELD_TIP, TRIPOD_LABEL, deviceRecipeFor, recipeKeyForEventKind, type RecipeKey } from '../../lib/cameraRecipes'
import { trackEvent } from '../../lib/analytics'
import { estimateLightPollution, skyQualityLabelForScore } from '../../lib/darkSky'
import { getStarObjects, type SkyMapObject } from '../../lib/skyMapLayers'
import { forecastLookaheadDays } from '../../lib/entitlementLimits'
import { useAuth } from '../../lib/auth'
import { getPreferredEventTypes, hasCompletedEventPreferences } from '../../lib/eventPreferences'
import { hasCompletedOnboardingFlow } from '../../components/OnboardingFlow'
import { isLocalEvent } from '../../lib/eventFilters'
import { buildVisiblePlanetsEvent } from '../../lib/visiblePlanets'
import { EventPreferencePrompt } from '../../components/mobile/EventPreferencePrompt'
import { HubIcon } from '../../components/mobile/HubIcon'
import { buildEventDetail, detailInputFromTonightTarget, type EntryDetailSubject } from '../../lib/entryDetail'
import type { SkyEvent } from '../../lib/db'
import {
  dismissEquipmentPrompt,
  EQUIPMENT_OPTIONS,
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
  onOpenEntry: (subject: EntryDetailSubject) => void
  onOpenTonight: () => void
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
  asteroid_approach: { label: 'ASTEROID', color: 'var(--dt-rust-400)' },
  fireball: { label: 'FIREBALL', color: 'var(--dt-rust-400)' },
  solar_flare: { label: 'SOLAR FLARE', color: 'var(--dt-solar-400)' },
}

function kickerFor(kind: string): { label: string; color: string } {
  return KIND_KICKER[kind] ?? { label: 'SKY EVENT', color: 'var(--dt-primary)' }
}

export function HubView({ city, onOpenTab, onLogAttempt, onOpenEntry, onOpenTonight }: HubViewProps) {
  const [plan, setPlan] = useState<TonightPlan | null>(null)
  const [advisory, setAdvisory] = useState<DailyViewingAdvisory | null>(null)
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [preferredKinds, setPreferredKinds] = useState<string[]>([])
  const [preferredEvents, setPreferredEvents] = useState<SkyEvent[]>([])
  const [preferencesReady, setPreferencesReady] = useState(() => hasCompletedEventPreferences())
  const [reminders, setReminders] = useState<GetReadyReminder[]>(() => listGetReadyReminders())
  // The sky map opens at a real, bookmarkable URL (/sky-map) rather than
  // pure local state -- a direct/bookmarked load of that path still lands
  // on the Hub tab underneath (see MobileShell's tabFromPathname fallback)
  // with the map already open on top, so the back button and share links
  // both work as expected.
  const location = useLocation()
  const navigate = useNavigate()
  const mapOpen = location.pathname === '/app/sky-map'
  const [equipment, setEquipment] = useState<EquipmentChoice | null>(() => getEquipmentChoice())
  const [showEquipmentPrompt, setShowEquipmentPrompt] = useState(() => shouldAskForEquipment())
  const [outlook, setOutlook] = useState<DailyViewingAdvisory[]>([])
  const trackedFeedLoadRef = useRef<string | null>(null)
  const compass = useDeviceCompass()
  const { user } = useAuth()
  const hasPremium = Boolean(user?.entitled)
  const outlookDays = forecastLookaheadDays(hasPremium)

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
      const preferred = await getPreferredEventTypes()
      setPreferredKinds(preferred)
      const upcoming = await getUpcomingEvents(80)
      setPreferredEvents(
        [buildVisiblePlanetsEvent(new Date(), city.lat, city.lon), ...upcoming.filter((event) => isLocalEvent(event, city.lat, city.lon))]
          .sort((a, b) => {
            const aPreferred = preferred.includes(a.kind) ? 0 : 1
            const bPreferred = preferred.includes(b.kind) ? 0 : 1
            return aPreferred - bPreferred || a.startsAt.localeCompare(b.startsAt)
          })
          .slice(0, 4),
      )
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
    let cancelled = false
    fetchViewingForecast(city.lat, city.lon, outlookDays)
      .then((forecast) => {
        if (!cancelled) setOutlook(forecast.days)
      })
      .catch(() => {
        if (!cancelled) setOutlook([])
      })
    return () => {
      cancelled = true
    }
  }, [city.lat, city.lon, outlookDays])

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
  // Naked-eye-bright stars, up right now -- shown as a fallback so Tonight
  // always has something concrete to look at even on a night with nothing
  // in the event cache, instead of just an empty-state sentence.
  const visibleStars: SkyMapObject[] =
    plan.targets.length === 0
      ? getStarObjects(new Date(), city.lat, city.lon)
          .filter((star) => star.visible && (star.magnitude ?? 99) <= 2.5)
          .sort((a, b) => b.altitudeDeg - a.altitudeDeg)
          .slice(0, 6)
      : []
  // Basic camera setup, free for every account -- the deeper device-specific
  // walkthrough, preset downloads, and gear fit stay behind the Sky Pass in
  // Plan (see PlanView/CameraRecipe), but the essential mode/lens/tripod
  // call should never be paywalled.
  const cameraRecipeKey: RecipeKey = (topTarget ? recipeKeyForEventKind(topTarget.kind) : null) ?? 'starry_sky'
  const cameraDevice = getDefaultDevice()
  const cameraDeviceRecipe = deviceRecipeFor(cameraRecipeKey, cameraDevice)
  const cameraRecipeTitle = CAMERA_RECIPES[cameraRecipeKey].title
  const sunsetAt = plan.darknessWindow.sunsetAt
  const darkAt = plan.darknessWindow.astronomicalDuskAt
  const cloudCover = advisory ? `${Math.round(advisory.cloudCoverPct)}%` : '—'
  const lowCloud = advisory?.lowCloudCoverPct == null ? '—' : `${Math.round(advisory.lowCloudCoverPct)}%`
  const highCloud = advisory?.highCloudCoverPct == null ? '—' : `${Math.round(advisory.highCloudCoverPct)}%`
  const visibility = advisory ? formatWatchValue(advisory.quality) : '—'
  const moon = `${Math.round(plan.moonIlluminationPct)}%`
  const lightPollution = estimateLightPollution(city.lat, city.lon)
  const clarity = advisory ? Math.max(0, 100 - advisory.cloudCoverPct) : 70
  const targetDirection = topTarget?.direction
  const turnHint =
    compass.headingDeg != null && targetDirection ? turnInstruction(compass.headingDeg, targetDirection.azimuthDeg) : 'Enable compass'

  function applyPreferredKinds(kinds: string[]) {
    setPreferredKinds(kinds)
    setPreferredEvents((current) =>
      [...current].sort((a, b) => {
        const aPreferred = kinds.includes(a.kind) ? 0 : 1
        const bPreferred = kinds.includes(b.kind) ? 0 : 1
        return aPreferred - bPreferred || a.startsAt.localeCompare(b.startsAt)
      }),
    )
    setPreferencesReady(true)
  }

  function expandTarget(target: TonightPlan['targets'][number]) {
    recordLocalTargetTap(target, 'mobile_hub', city.name)
    trackEvent('Tapped visible target', { targetId: target.eventId, title: target.title, kind: target.kind, source: 'mobile_hub' })
    if (!equipment && shouldAskForEquipment()) setShowEquipmentPrompt(true)
    if (!plan) return
    onOpenEntry(buildEventDetail(detailInputFromTonightTarget(target, plan.moonIlluminationPct, plan.darknessWindow), advisory))
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
      {/* Onboarding's own "interests" step already covers this for anyone
          who hasn't been through onboarding yet -- showing this standalone
          prompt at the same time duplicated it directly underneath the
          onboarding modal. Only offer it as a later feed nudge once
          onboarding is out of the way and the user still hasn't set any. */}
      {!preferencesReady && hasCompletedOnboardingFlow() && <EventPreferencePrompt onSaved={applyPreferredKinds} />}

      {preferencesReady && preferredEvents.length > 0 && (
        <section className="dt-for-you">
          <div className="dt-section-head">
            <span className="dt-section-eyebrow"><HubIcon name="spark" />For you</span>
            <button type="button" className="dt-chevron-btn" onClick={() => onOpenTab('events')} aria-label="View all personalised events">
              <HubIcon name="chevron" />
            </button>
          </div>
          <p className="dt-feed-intro">Your priorities, next in the sky.</p>
          {preferredEvents.map((event) => {
            const preferred = preferredKinds.includes(event.kind)
            const kicker = kickerFor(event.kind)
            return (
              <button type="button" className={`dt-feed-row dt-feed-row--personalised${preferred ? ' is-preferred' : ''}`} key={event.id} onClick={() => onOpenTab('events')}>
                <div className="dt-feed-row-top">
                  <span className="dt-feed-kicker" style={{ color: kicker.color }}><span className="dt-dot" />{preferred ? 'FOR YOU' : kicker.label}</span>
                  <span className="dt-feed-time">{formatTime(event.startsAt, city.timeZone)}</span>
                </div>
                <div className="dt-feed-headline-row"><span className="dt-feed-headline">{event.title}</span><span className="dt-feed-chevron">+</span></div>
                <span className="dt-feed-meta">{kicker.label} · {new Date(event.startsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
              </button>
            )
          })}
        </section>
      )}

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

        <button type="button" className="dt-bracket dt-map-preview" onClick={() => navigate('/app/sky-map')} aria-label="Open full sky map">
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
            <span className="dt-widget-caption">{visibility} · low {lowCloud} · high {highCloud}</span>
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
        <div className="dt-widget-cell" title={`Technical reference: Bortle ${lightPollution.bortleClass} of 9`}>
          <span className="dt-widget-eyebrow"><HubIcon name="spark" />Light</span>
          <span className="dt-widget-value">{lightPollution.skyQualityScore}/5</span>
          <span className="dt-widget-caption">{skyQualityLabelForScore(lightPollution.skyQualityScore)}</span>
          </div>
        </div>
      </section>

      <div className="dt-stitch" />

      {/* Essential mode/lens/tripod for the default device -- free for every
          account. The deeper device-specific walkthrough, downloadable
          presets, and gear fit stay behind the Sky Pass, in Plan. */}
      <section>
        <div className="dt-section-eyebrow"><HubIcon name="target" />Camera setup</div>
        <p className="dt-empty-hint">Shooting {cameraRecipeTitle.toLowerCase()} on {CAMERA_PROFILES[cameraDevice].name}:</p>
        <div className="dt-camera-setup-facts">
          <div>
            <span>Mode</span>
            <strong>{cameraDeviceRecipe.mode}</strong>
          </div>
          <div>
            <span>Lens</span>
            <strong>{cameraDeviceRecipe.lens}</strong>
          </div>
          <div>
            <span>Stability</span>
            <strong>{TRIPOD_LABEL[cameraDeviceRecipe.tripod]}</strong>
          </div>
        </div>
        {TRIPOD_HANDHELD_TIP[cameraDeviceRecipe.tripod] && (
          <p className="dt-empty-hint">{TRIPOD_HANDHELD_TIP[cameraDeviceRecipe.tripod]}</p>
        )}
        <button type="button" className="dt-chevron-btn dt-camera-setup-link" onClick={() => onOpenTab('calendar')}>
          Full setup, presets &amp; gear fit <HubIcon name="chevron" />
        </button>
      </section>

      <div className="dt-stitch" />

      {/* Free accounts see this capped to a 3-day outlook (see
          entitlementLimits.ts); Sky Pass unlocks the full 16-day window.
          Lives here on Today (not Plan) because Plan is fully paywalled for
          free accounts and this is meant to be part of their free taste. */}
      <section>
        <div className="dt-section-eyebrow"><HubIcon name="spark" />Sky conditions</div>
        <p className="dt-empty-hint">Sky quality {lightPollution.skyQualityScore}/5 · {skyQualityLabelForScore(lightPollution.skyQualityScore)}. Higher is darker and easier for stargazing.</p>
        <div className="mobile-mini-list">
          {outlook.slice(0, outlookDays).map((day, index) => (
            <div className="mobile-mini-row mobile-plan-row mobile-plan-row--status" key={day.date}>
              <span className="mobile-event-kind">
                {index === 0 ? 'Today' : new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}
              </span>
              <span className="mobile-mini-row-name">Sky quality {lightPollution.skyQualityScore}/5</span>
              <span className="mobile-mini-row-meta">{Math.round(day.cloudCoverPct)}% cloud</span>
              <span className="mobile-plan-row-status">{Math.round(day.precipitationChancePct)}% rain chance</span>
            </div>
          ))}
        </div>
        {!hasPremium && <p className="mobile-empty-hint">Sky Pass unlocks the full 16-day outlook — you're seeing the next {outlookDays} days.</p>}
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
          // Goes back in history rather than to a hardcoded path -- opening
          // the map pushed a new entry on top of wherever this view was
          // already mounted (mobile's Hub tab or desktop's Explore/Today),
          // so this is the one close behavior that's correct in both.
          onClose={() => navigate(-1)}
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
                  moonIlluminationPct: plan.moonIlluminationPct,
                  cloudCoverPct: advisory?.cloudCoverPct,
                  directionLabel: topTarget.direction?.compassLabel,
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
          <button type="button" className="dt-chevron-btn" onClick={onOpenTonight} aria-label="View all of tonight's events and stars">
            <HubIcon name="chevron" />
          </button>
        </div>
        {plan.targets.length === 0 ? (
          <>
            {/* A skip night should explain why (not just declare defeat) and
                always point to the best realistic alternative -- either
                tonight's brightest stars or the next clear window. */}
            {plan.rating === 'skip' && plan.reasons.length > 0 ? (
              <ul className="dt-empty-reasons">
                {plan.reasons.map((reason) => (
                  <li key={reason} className="dt-empty-hint">{reason}</li>
                ))}
              </ul>
            ) : (
              <p className="dt-empty-hint">
                {plan.rating === 'skip' ? 'Nothing worth going outside for tonight.' : 'No events cached yet — try again once online.'}
              </p>
            )}
            {visibleStars.length > 0 ? (
              <>
                <p className="dt-empty-hint">Still worth a look — the brightest naked-eye stars up right now:</p>
                <div className="mobile-mini-list">
                  {visibleStars.map((star) => (
                    <div className="mobile-mini-row mobile-plan-row mobile-plan-row--status" key={star.id}>
                      <span className="mobile-event-kind">STAR</span>
                      <span className="mobile-mini-row-name">{star.name}</span>
                      <span className="mobile-mini-row-meta">{star.compassLabel}, {Math.round(star.altitudeDeg)}° up</span>
                      <span className="mobile-plan-row-status">{star.constellation ?? ''}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              plan.nextClearWindow && (
                <p className="dt-empty-hint">
                  Clouded out tonight — {new Date(`${plan.nextClearWindow.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long' })} looks better ({Math.round(plan.nextClearWindow.cloudCoverPct)}% cloud).
                </p>
              )
            )}
          </>
        ) : (
          <>
            <div className="dt-today-rule">
              <span>TODAY</span>
              <span />
            </div>
            {rankedTargets.slice(0, 3).map((target) => {
              const kicker = kickerFor(target.kind)
              return (
                <button type="button" key={target.eventId} className="dt-feed-row" onClick={() => expandTarget(target)}>
                  <div className="dt-feed-row-top">
                    <span className="dt-feed-kicker" style={{ color: kicker.color }}>
                      <span className="dt-dot" />
                      {kicker.label}
                    </span>
                    <span className="dt-feed-time">{formatTime(target.bestTime, plan.timeZone)}</span>
                  </div>
                  <div className="dt-feed-headline-row">
                    <span className="dt-feed-headline">{target.title}</span>
                    <span className="dt-feed-chevron">+</span>
                  </div>
                  <span className="dt-feed-meta">
                    {target.direction ? `${target.direction.compassLabel}, ${Math.round(target.direction.altitudeDeg)}° up` : 'Direction varies'} ·{' '}
                    {target.nakedEyeVisible ? 'naked-eye' : 'needs binoculars or a scope'}
                  </span>
                </button>
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

      <StreakSection />
      <CitizenScienceSection />
      <CommunityDigestSection onOpenJournal={() => onOpenTab('journal')} />

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
