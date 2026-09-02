import { useEffect, useRef, useState } from 'react'
import { getDisplayName, saveDisplayName } from '../lib/displayName'
import { syncOnboardingToAccount } from '../lib/auth'
import { InterestsPicker } from './InterestsPicker'
import { getPreferredEventTypes, savePreferredEventTypes } from '../lib/eventPreferences'
import { LocationSearchInput } from './LocationSearchInput'
import { ensureNotificationPermission } from '../lib/getReadyReminders'
import { trackEvent } from '../lib/analytics'
import { Starfield } from './mobile/Starfield'
import { useThemeState } from '../lib/theme'
import type { AuthUser } from '../lib/auth'
import type { City } from '../lib/cities'
import type { CurrentLocation } from '../lib/currentLocation'

export const ONBOARDING_FLOW_KEY = 'atlas-onboarding-flow-complete'
export const ONBOARDING_REQUIRED_KEY = 'atlas-onboarding-flow-required'

export function hasCompletedOnboardingFlow(): boolean {
  return localStorage.getItem(ONBOARDING_FLOW_KEY) === '1'
}

export function requiresOnboardingFlow(): boolean {
  return localStorage.getItem(ONBOARDING_REQUIRED_KEY) === '1'
}

export function markOnboardingRequired(): void {
  localStorage.removeItem(ONBOARDING_FLOW_KEY)
  localStorage.setItem(ONBOARDING_REQUIRED_KEY, '1')
}

export function markOnboardingComplete(): void {
  localStorage.setItem(ONBOARDING_FLOW_KEY, '1')
  localStorage.removeItem(ONBOARDING_REQUIRED_KEY)
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
  // Landing no longer asks for location up front (it's deferred to this
  // step specifically, so a first-time visitor sees what Atlas does before
  // any permission prompt) -- this is how that step actually triggers the
  // browser's own geolocation permission request, same as the old landing
  // page's "use my current location" button did.
  requestLocation?: () => void
  onDone: () => void
}

// First-run onboarding: name, interests, location, notifications (per the
// notes' "Onboarding overhaul" list). Each step is skippable and starts
// pre-filled from whatever's already saved, so this never re-asks for
// something the user already told Atlas via another surface (mobile's
// EventPreferencePrompt, geolocation, etc).
export function OnboardingFlow({ city, user, setManualLocation, requestLocation, onDone }: OnboardingFlowProps) {
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
    markOnboardingComplete()
    // Signed-in accounts also get this persisted on the account itself (not
    // just this browser's localStorage) so a new device/browser doesn't get
    // sent through onboarding again just because it's never seen this flag.
    if (user) void syncOnboardingToAccount()
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
    // Always persist, even with zero interests picked -- otherwise skipping
    // this step leaves the completion flag unset and EventPreferencePrompt
    // re-shows on every dashboard visit.
    await savePreferredEventTypes(interests)
    if (interests.length > 0) trackEvent('Set event preferences', { kinds: interests, source: 'onboarding' })
    advance()
  }

  function handleLocationContinue() {
    if (chosenCity) setManualLocation?.(chosenCity)
    advance()
  }

  function handleUseCurrentLocation() {
    setManualLocation?.(null)
    requestLocation?.()
    trackEvent('Onboarding location: use current location clicked')
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
      // This is a direct, deliberate retry the user just tapped -- unlike
      // Events/Plan/the Deep-sky planner's passive calls, it should always
      // actually attempt the browser prompt again rather than honor an
      // earlier passive dismissal.
      const granted = await ensureNotificationPermission({ force: true })
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

  const [theme] = useThemeState()

  return (
    <div className="onboarding-overlay az-overlay" style={{ padding: 'max(3.5rem, env(safe-area-inset-top)) 1.5rem 1.75rem', flexDirection: 'column', alignItems: 'stretch' }}>
      <div className="az-overlay-bg">
        <Starfield dark={theme === 'dark'} />
      </div>
      <div className="az-onboard-bars" style={{ position: 'relative', zIndex: 1 }}>
        {STEPS.map((s, i) => (
          <span key={s} className={`az-onboard-bar${i <= stepIndex ? ' is-done' : ''}`} />
        ))}
      </div>

      <div style={{ position: 'relative', zIndex: 1, flex: 1, minHeight: 0, overflowY: 'auto', paddingTop: '2.125rem' }}>
        <span className="az-kicker">
          STEP {stepIndex + 1} OF {STEPS.length}
        </span>

        {step === 'name' && (
          <>
            <h1 className="az-h1" style={{ fontSize: '2rem', margin: '0.5rem 0 0.5rem' }}>
              What should Atlas call you?
            </h1>
            <p className="az-muted" style={{ margin: '0 0 1.25rem', fontSize: '0.90625rem' }}>
              Used for your feed greeting — nothing else.
            </p>
            <input
              type="text"
              className="az-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              maxLength={40}
              autoFocus
            />
          </>
        )}

        {step === 'interests' && (
          <>
            <h1 className="az-h1" style={{ fontSize: '2rem', margin: '0.5rem 0 0.5rem' }}>
              What do you want to see?
            </h1>
            <p className="az-muted" style={{ margin: '0 0 1.25rem', fontSize: '0.90625rem' }}>
              {hasSavedInterests
                ? 'Pre-filled from what you already follow — tap any you want to remove.'
                : 'Atlas will prioritise these in your feed and week strip.'}
            </p>
            <InterestsPicker selected={interests} onToggleCategory={toggleInterest} />
          </>
        )}

        {step === 'location' && (
          <>
            <h1 className="az-h1" style={{ fontSize: '2rem', margin: '0.5rem 0 0.5rem' }}>
              Where are you observing from?
            </h1>
            <p className="az-muted" style={{ margin: '0 0 0.5rem', fontSize: '0.90625rem' }}>
              Atlas needs a location to work out your darkness window and what&rsquo;s actually above you.
            </p>
            <p className="az-muted" style={{ margin: '0 0 1rem', fontSize: '0.8125rem' }}>
              Current Atlas location: {city.name}
            </p>
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
            {requestLocation && !chosenCity && (
              <button type="button" className="az-btn az-btn-outline az-btn-block" style={{ marginTop: '0.75rem' }} onClick={handleUseCurrentLocation}>
                Use my current location
              </button>
            )}
          </>
        )}

        {step === 'notifications' && (
          <>
            <h1 className="az-h1" style={{ fontSize: '2rem', margin: '0.5rem 0 0.5rem' }}>
              Stay in the loop
            </h1>
            {!localNotificationsSupported ? (
              <p className="az-muted" style={{ fontSize: '0.90625rem' }}>
                Notifications aren&apos;t available on this device/browser — you can still check Atlas any time.
              </p>
            ) : (
              <>
                <p className="az-muted" style={{ margin: '0 0 0.5rem', fontSize: '0.90625rem' }}>
                  Get a nudge when watchlisted events and great conditions come up — works right away, no account needed.
                </p>
                {!user && (
                  <p className="az-muted" style={{ fontSize: '0.8125rem' }}>
                    Sign in later to also get notified on other devices.
                  </p>
                )}
                {pushError && (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--az-flagship)' }}>{pushError}</p>
                )}
                {pushEnabled && (
                  <p style={{ fontSize: '0.8125rem', color: 'oklch(var(--az-pill-l) 0.13 145)' }}>Notifications enabled.</p>
                )}
              </>
            )}
          </>
        )}
      </div>

      <div style={{ position: 'relative', zIndex: 1, flex: 'none', display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
        {step === 'name' && (
          <>
            <button type="button" className="az-text-btn" onClick={advance}>
              Skip
            </button>
            <button type="button" className="az-btn az-btn-primary" style={{ flex: 1 }} onClick={handleNameContinue}>
              Continue
            </button>
          </>
        )}
        {step === 'interests' && (
          <>
            <button type="button" className="az-text-btn" onClick={advance}>
              Skip
            </button>
            <button type="button" className="az-btn az-btn-primary" style={{ flex: 1 }} onClick={handleInterestsContinue}>
              Continue
            </button>
          </>
        )}
        {step === 'location' && (
          <button type="button" className="az-btn az-btn-primary" style={{ flex: 1 }} onClick={chosenCity ? handleLocationContinue : advance}>
            {chosenCity ? 'Use this location' : 'Looks good'}
          </button>
        )}
        {step === 'notifications' && (
          <>
            <button type="button" className="az-text-btn" onClick={finish}>
              {pushEnabled ? 'Done' : 'Not now'}
            </button>
            {!pushEnabled && (
              <button type="button" className="az-btn az-btn-primary" style={{ flex: 1 }} onClick={enableNotifications} disabled={pushBusy || !localNotificationsSupported}>
                {pushBusy ? 'Enabling…' : 'Enable notifications'}
              </button>
            )}
            {pushEnabled && (
              <button type="button" className="az-btn az-btn-primary" style={{ flex: 1 }} onClick={finish}>
                Finish
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
