import { useEffect, useRef, useState } from 'react'
import { getDisplayName, saveDisplayName } from '../lib/displayName'
import { InterestsPicker } from './InterestsPicker'
import { getPreferredEventTypes, savePreferredEventTypes } from '../lib/eventPreferences'
import { LocationSearchInput } from './LocationSearchInput'
import { ensureNotificationPermission } from '../lib/getReadyReminders'
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

// Local "get ready" reminders (localStorage + the browser's own Notification
// permission, see lib/getReadyReminders.ts) work for guests with no account
// at all -- only the optional cross-device server push sync needs sign-in.
// Checked separately from lib/push.ts's isPushSupported(), which also
// requires a service worker + VAPID key just for that sync layer.
const localNotificationsSupported = typeof window !== 'undefined' && 'Notification' in window

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
  // Guards against a second Notification.requestPermission() firing before
  // React re-renders the disabled button -- a fast double-tap (common on
  // mobile, where touchstart/click can both land in one gesture) invokes
  // this handler twice inside the same tick, since `disabled={pushBusy}`
  // only takes effect on the next render. Two overlapping
  // requestPermission() calls make the native prompt flash and then
  // dismiss itself before the user can respond to either. A ref updates
  // synchronously, so it blocks the second call before it starts.
  const requestingPermissionRef = useRef(false)

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

  async function enableNotifications() {
    if (requestingPermissionRef.current) return
    requestingPermissionRef.current = true
    setPushBusy(true)
    setPushError(null)
    try {
      // Browsers refuse to show the permission dialog at all once a site is
      // blocked -- no prompt, no error from the API, requestPermission()
      // just resolves 'denied' immediately (ensureNotificationPermission
      // short-circuits the same way). From the button's perspective that's
      // indistinguishable from doing nothing, so it's worth checking and
      // naming explicitly rather than falling through to the generic "not
      // granted" message, which reads the same for someone who just hasn't
      // decided yet.
      if ('Notification' in window && Notification.permission === 'denied') {
        throw new Error('Notifications are blocked for this site. Enable them in your browser’s site settings, then try again.')
      }
      // Works for guests too: this only ever requires the browser's own
      // Notification permission (no account needed) for local "get ready"
      // reminders, and separately best-effort upgrades to synced server
      // push if already signed in -- never throws just for being a guest,
      // unlike calling subscribeToPush() directly.
      const granted = await ensureNotificationPermission()
      if (!granted) {
        // Notification.permission still reflects whatever
        // requestPermission() actually resolved to. 'denied' means someone
        // explicitly clicked Block at some point (handled above, before
        // this call). If it's still 'default' after a request, no one
        // answered anything -- the browser's own adaptive "quieter
        // messaging" throttling (Chrome/Edge, triggered after a site racks
        // up enough dismissed/ignored prompts) replaced the blocking
        // dialog with a non-interactive address-bar chip that just fades
        // out on its own. That reads to a user as "the prompt flashed and
        // vanished before I could click anything" -- which is exactly
        // right, and isn't something this page can force back open.
        const quieted = 'Notification' in window && Notification.permission === 'default'
        throw new Error(
          quieted
            ? 'Your browser auto-dismissed the notification prompt instead of asking you (a quieter permission UI it switches to after repeated dismissals). Look for a small bell/notification icon in the address bar, or reset this site’s notification permission in your browser’s site settings, then try again.'
            : 'Notifications permission was not granted.',
        )
      }
      setPushEnabled(true)
      trackEvent('Enabled notifications', { source: 'onboarding', signedIn: Boolean(user) })
    } catch (err) {
      setPushError(err instanceof Error ? err.message : 'Could not enable notifications.')
    } finally {
      setPushBusy(false)
      requestingPermissionRef.current = false
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
            {!localNotificationsSupported ? (
              <p>Notifications aren&apos;t available on this device/browser — you can still check Atlas any time.</p>
            ) : (
              <>
                <p>Get a nudge when watchlisted events and great conditions come up — works right away, no account needed.</p>
                {!user && <p className="onboarding-flow-hint">Sign in later to also get notified on other devices.</p>}
                {pushError && <p className="onboarding-flow-error">{pushError}</p>}
                {pushEnabled && <p className="onboarding-flow-success">Notifications enabled.</p>}
              </>
            )}
            <div className="onboarding-flow-actions">
              <button type="button" className="onboarding-flow-skip" onClick={finish}>
                {pushEnabled ? 'Done' : 'Not now'}
              </button>
              {localNotificationsSupported && !pushEnabled && (
                <button type="button" className="onboarding-flow-primary" onClick={enableNotifications} disabled={pushBusy}>
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
