import { useEffect, useState } from 'react'
import { getTonightPlan, type TonightPlan } from '../lib/tonightTargets'
import { pullSkyEvents } from '../lib/sync'
import { useDeviceCompass, turnInstruction } from '../lib/deviceCompass'
import { recipeKeyForEventKind } from '../lib/cameraRecipes'
import { CameraRecipe } from '../components/CameraRecipe'
import { getDefaultDevice, CAMERA_PROFILES } from '../lib/cameraProfiles'
import { trackEvent } from '../lib/analytics'
import type { ObservationDraft } from '../lib/observationDraft'
import type { CurrentLocation } from '../lib/currentLocation'
import type { LocationStatus } from '../lib/geo'

const RATING_LABEL: Record<TonightPlan['rating'], string> = {
  great: 'Go outside — great conditions',
  good: 'Go outside',
  maybe: 'Maybe — worth a look',
  poor: 'Probably skip tonight',
  skip: 'Skip tonight',
}

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: 'Easy',
  moderate: 'Moderate',
  hard: 'Hard',
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function formatDarknessWindow(window: TonightPlan['darknessWindow']): string | null {
  if (!window.astronomicalDuskAt || !window.astronomicalDawnAt) return null
  return `Astronomically dark ${formatTime(window.astronomicalDuskAt)}–${formatTime(window.astronomicalDawnAt)}`
}

// True during evening or morning twilight -- after the Sun sets (civil dusk)
// but before it's fully dark (astronomical dusk), or the morning mirror of
// that. Used to surface the twilight-sky camera recipe, which otherwise has
// no SkyEvent kind of its own to hang a Tonight target off of.
function isTwilightNow(window: TonightPlan['darknessWindow'], now: Date): boolean {
  const inRange = (startIso: string | null, endIso: string | null) => {
    if (!startIso || !endIso) return false
    const time = now.getTime()
    return time >= new Date(startIso).getTime() && time < new Date(endIso).getTime()
  }
  return inRange(window.civilDuskAt, window.astronomicalDuskAt) || inRange(window.astronomicalDawnAt, window.civilDawnAt)
}

interface TonightViewProps {
  city: CurrentLocation
  locationStatus: LocationStatus
  onLogAttempt: (draft: ObservationDraft) => void
}

export function TonightView({ city, locationStatus, onLogAttempt }: TonightViewProps) {
  const [plan, setPlan] = useState<TonightPlan | null>(null)
  const [error, setError] = useState(false)
  const [expandedRecipe, setExpandedRecipe] = useState<string | null>(null)
  const [showTwilightRecipe, setShowTwilightRecipe] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const compass = useDeviceCompass()

  useEffect(() => {
    trackEvent('Viewed Tonight page', { city: city.name })
  }, [city.name])

  useEffect(() => {
    let cancelled = false
    setPlan(null)
    setError(false)

    async function load() {
      try {
        await pullSkyEvents()
        const result = await getTonightPlan(city.lat, city.lon)
        if (!cancelled) setPlan(result)
      } catch {
        if (!cancelled) setError(true)
      }
    }

    load()

    function handleOnline() {
      setIsOnline(true)
      load()
    }
    function handleOffline() {
      setIsOnline(false)
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      cancelled = true
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [city])

  if (error) {
    return (
      <section className="widget-section">
        <h2>Tonight near {city.name}</h2>
        <p className="scrapbook-hint">Couldn&apos;t work out tonight&apos;s conditions — try again once you&apos;re back online.</p>
      </section>
    )
  }

  if (plan === null) {
    return (
      <section className="widget-section">
        <h2>Tonight near {city.name}</h2>
        <p>Loading&hellip;</p>
      </section>
    )
  }

  const darknessLabel = formatDarknessWindow(plan.darknessWindow)
  const hasDirectionalTargets = plan.targets.some((target) => target.direction !== null)
  const twilightNow = isTwilightNow(plan.darknessWindow, new Date())

  return (
    <section className="widget-section">
      <h2>Tonight near {city.name}</h2>
      {!isOnline && <p className="scrapbook-hint">You're offline — showing cached data.</p>}
      {(locationStatus === 'denied' || locationStatus === 'unsupported') && (
        <p className="scrapbook-hint">
          Location access {locationStatus === 'denied' ? 'was denied' : "isn't available"} — showing {city.name} instead.
          Set your city manually in Settings, or grant location access there.
        </p>
      )}
      <div className={`tonight-rating tonight-rating--${plan.rating}`}>
        <span className="tonight-rating-label">{RATING_LABEL[plan.rating]}</span>
        {plan.reasons.length > 0 && (
          <ul className="tonight-reasons">
            {plan.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}
        {darknessLabel && <p className="tonight-darkness">{darknessLabel}</p>}
      </div>

      {plan.generalPhotoWindow && (
        <div className="tonight-target">
          <div className="tonight-target-header">
            <span className="row-text">Best time tonight for a general sky photo</span>
          </div>
          <p className="row-meta">
            {formatTime(plan.generalPhotoWindow.startsAt)}–{formatTime(plan.generalPhotoWindow.endsAt)}
          </p>
          <p className="tonight-target-reason">{plan.generalPhotoWindow.reason}</p>
        </div>
      )}

      {twilightNow && (
        <div className="tonight-target">
          <div className="row-trigger">
            <button
              type="button"
              className="row-trigger-main"
              onClick={() => setShowTwilightRecipe((shown) => !shown)}
              aria-expanded={showTwilightRecipe}
            >
              <span className="row-marker" />
              <span className="row-text">It's twilight right now</span>
            </button>
          </div>
          {showTwilightRecipe && (
            <div className="row-detail">
              <CameraRecipe recipeKey="twilight" />
            </div>
          )}
        </div>
      )}

      {plan.targets.length === 0 ? (
        <p className="scrapbook-hint">
          {plan.rating === 'skip'
            ? 'Nothing worth going outside for tonight — check back tomorrow, or browse the calendar for a better night.'
            : 'No events found for tonight in the local cache yet — try again once you’re back online.'}
        </p>
      ) : (
        <>
          {hasDirectionalTargets && compass.status !== 'active' && (
            <button type="button" className="tonight-compass-button" onClick={compass.enable}>
              📱 Point my phone at a target
            </button>
          )}
          {compass.status === 'denied' && (
            <p className="scrapbook-hint">Compass access was denied — direction is still shown below, just not the live turn hint.</p>
          )}
          <ul className="row-list">
            {plan.targets.map((target) => {
              const recipeKey = recipeKeyForEventKind(target.kind)
              const expanded = expandedRecipe === target.eventId
              return (
                <li key={target.eventId} className="tonight-target">
                  <div className="tonight-target-header">
                    <span className="row-text">{target.title}</span>
                    <span className="row-kind">{DIFFICULTY_LABEL[target.difficulty]}</span>
                  </div>
                  <p className="row-meta">
                    {formatTime(target.bestTime)} · {target.phoneFriendly ? 'Phone-friendly' : 'Tough for a phone'} ·{' '}
                    {target.nakedEyeVisible ? 'Naked-eye' : 'Needs binoculars or a scope'}
                    {target.direction && (
                      <>
                        {' '}
                        · {target.direction.compassLabel} ({Math.round(target.direction.altitudeDeg)}° up)
                      </>
                    )}
                  </p>
                  {target.direction && compass.status === 'active' && compass.headingDeg != null && (
                    <p className="tonight-target-turn">{turnInstruction(compass.headingDeg, target.direction.azimuthDeg)}</p>
                  )}
                  <p className="tonight-target-reason">{target.reason}</p>
                  <p className="tonight-target-reason">{target.viewingNote}</p>
                  <div className="tonight-target-actions">
                    {recipeKey && (
                      <button
                        type="button"
                        className="tonight-recipe-toggle"
                        onClick={() => {
                          if (!expanded) trackEvent('Opened target recommendation', { target: target.title, kind: target.kind })
                          setExpandedRecipe(expanded ? null : target.eventId)
                        }}
                        aria-expanded={expanded}
                      >
                        {expanded ? 'Hide camera recipe' : 'Camera recipe'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="tonight-recipe-toggle"
                      onClick={() =>
                        onLogAttempt({
                          eventId: target.eventId,
                          targetName: target.title,
                          deviceUsed: CAMERA_PROFILES[getDefaultDevice()].name,
                          cameraRecipeUsed: recipeKey ?? undefined,
                          locationLabel: city.name,
                        })
                      }
                    >
                      Log attempt
                    </button>
                  </div>
                  {expanded && recipeKey && <CameraRecipe recipeKey={recipeKey} />}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
