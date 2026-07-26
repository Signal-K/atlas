import { useEffect, useState } from 'react'
import { getDisplayName, saveDisplayName } from '../lib/displayName'
import { InterestsPicker } from './InterestsPicker'
import { getPreferredEventTypes, savePreferredEventTypes } from '../lib/eventPreferences'
import { LocationSearchInput } from './LocationSearchInput'
import { isPushSupported, subscribeToPush } from '../lib/push'
import { trackEvent } from '../lib/analytics'
import type { AuthUser } from '../lib/auth'
import type { City } from '../lib/cities'
import type { CurrentLocation } from '../lib/currentLocation'

export const ONBOARDING_FLOW_KEY = 'atlas-onboarding-flow-complete'

export function hasCompletedOnboardingFlow(): boolean {
  return localStorage.getItem(ONBOARDING_FLOW_KEY) === '1'
}

type Step = 'name' | 'interests' | 'location' | 'notifications'
const STEPS: Step[] = ['name', 'interests', 'location', 'notifications']

interface OnboardingFlowProps {
  city: CurrentLocation
  user: AuthUser | null
  setManualLocation?: (city: City | null) => void
  onDone: () => void
}

// First-run onboarding: name, interests, location, notifications (per the
// notes' "Onboarding overhaul" list). Each step is skippable and starts
// pre-filled from whatever's already saved, so this never re-asks for
// something the user already told Atlas via another surface (mobile's
// EventPreferencePrompt, geolocation, etc).
export function OnboardingFlow({ city, user, setManualLocation, onDone }: OnboardingFlowProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [name, setName] = useState(() => getDisplayName() ?? '')
  const [interests, setInterests] = useState<string[]>([])
  const [hasSavedInterests, setHasSavedInterests] = useState(false)
  const [locationQuery, setLocationQuery] = useState('')
  const [chosenCity, setChosenCity] = useState<City | null>(null)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushError, setPushError] = useState<string | null>(null)

  useEffect(() => {
    getPreferredEventTypes().then((kinds) => {
      setInterests(kinds)
      setHasSavedInterests(kinds.length > 0)
    })
  }, [])

  const step = STEPS[stepIndex]

  function finish() {
    localStorage.setItem(ONBOARDING_FLOW_KEY, '1')
    trackEvent('Completed onboarding flow')
    onDone()
  }

  function advance() {
    if (stepIndex + 1 >= STEPS.length) finish()
    else setStepIndex((current) => current + 1)
  }

  function toggleInterest(categoryKinds: string[]) {
    setInterests((current) => {
      const active = categoryKinds.every((kind) => current.includes(kind))
      return active ? current.filter((kind) => !categoryKinds.includes(kind)) : [...new Set([...current, ...categoryKinds])]
    })
  }

  async function handleNameContinue() {
    if (name.trim()) saveDisplayName(name)
    advance()
  }

  async function handleInterestsContinue() {
    if (interests.length > 0) {
      await savePreferredEventTypes(interests)
      trackEvent('Set event preferences', { kinds: interests, source: 'onboarding' })
    }
    advance()
  }

  function handleLocationContinue() {
    if (chosenCity) setManualLocation?.(chosenCity)
    advance()
  }

  async function enablePush() {
    setPushBusy(true)
    setPushError(null)
    try {
      await subscribeToPush()
      setPushEnabled(true)
      trackEvent('Enabled push notifications', { source: 'onboarding' })
    } catch (err) {
      setPushError(err instanceof Error ? err.message : 'Could not enable notifications.')
    } finally {
      setPushBusy(false)
    }
  }

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-modal onboarding-flow-modal">
        <div className="onboarding-flow-progress" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span key={s} className={`onboarding-flow-dot${i <= stepIndex ? ' is-active' : ''}`} />
          ))}
        </div>

        {step === 'name' && (
          <>
            <h2>What should Atlas call you?</h2>
            <p>Used for your feed greeting — nothing else.</p>
            <input
              type="text"
              className="onboarding-flow-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              maxLength={40}
              autoFocus
            />
            <div className="onboarding-flow-actions">
              <button type="button" className="onboarding-flow-skip" onClick={advance}>
                Skip
              </button>
              <button type="button" className="onboarding-flow-primary" onClick={handleNameContinue}>
                Continue
              </button>
            </div>
          </>
        )}

        {step === 'interests' && (
          <>
            <h2>What do you want to see?</h2>
            <p>
              {hasSavedInterests
                ? 'Pre-filled from what you already follow — tap any you want to remove.'
                : 'Atlas will prioritise these in your feed and week strip.'}
            </p>
            <InterestsPicker selected={interests} onToggleCategory={toggleInterest} />
            <div className="onboarding-flow-actions">
              <button type="button" className="onboarding-flow-skip" onClick={advance}>
                Skip
              </button>
              <button type="button" className="onboarding-flow-primary" onClick={handleInterestsContinue}>
                Continue
              </button>
            </div>
          </>
        )}

        {step === 'location' && (
          <>
            <h2>Where are you observing from?</h2>
            <p>Currently using {city.name}.</p>
            <LocationSearchInput
              id="onboarding-location"
              value={locationQuery}
              onChange={setLocationQuery}
              onSelect={(nextCity) => {
                setChosenCity(nextCity)
                setLocationQuery(nextCity.name)
              }}
              placeholder="Search for your town or city"
            />
            <div className="onboarding-flow-actions">
              <button
                type="button"
                className="onboarding-flow-primary"
                onClick={chosenCity ? handleLocationContinue : advance}
              >
                {chosenCity ? 'Use this location' : 'Looks good'}
              </button>
            </div>
          </>
        )}

        {step === 'notifications' && (
          <>
            <h2>Stay in the loop</h2>
            {!isPushSupported() ? (
              <p>Push notifications aren&apos;t available on this device/deployment — you can still check Atlas any time.</p>
            ) : !user ? (
              <p>Sign in later, then enable reminders from Settings.</p>
            ) : (
              <>
                <p>Get a nudge when watchlisted events and great conditions come up.</p>
                {pushError && <p className="onboarding-flow-error">{pushError}</p>}
                {pushEnabled && <p className="onboarding-flow-success">Notifications enabled.</p>}
              </>
            )}
            <div className="onboarding-flow-actions">
              <button type="button" className="onboarding-flow-skip" onClick={finish}>
                {pushEnabled ? 'Done' : 'Not now'}
              </button>
              {isPushSupported() && user && !pushEnabled && (
                <button type="button" className="onboarding-flow-primary" onClick={enablePush} disabled={pushBusy}>
                  {pushBusy ? 'Enabling…' : 'Enable notifications'}
                </button>
              )}
              {pushEnabled && (
                <button type="button" className="onboarding-flow-primary" onClick={finish}>
                  Finish
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
