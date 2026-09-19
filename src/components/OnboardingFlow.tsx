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
import { reverseGeocodeCity } from '../lib/reverseGeocode'
import { recordOnboardingEquipment } from '../lib/firstPlanJourney'
import {
  ONBOARDING_VERSION,
  getOnboardingAnswers,
  markOnboardingComplete,
  saveOnboardingAnswers,
  type ExperienceLevel,
} from '../lib/onboarding'
import {
  reportOnboardingSurveyDismissed,
  reportOnboardingSurveyShown,
  reportOnboardingSurveySubmitted,
} from '../lib/onboardingSurvey'
import { ClubsStep, EquipmentStep, ExperienceStep, SurveyStep } from './onboarding/AnswerSteps'
import type { AuthUser } from '../lib/auth'
import type { City } from '../lib/cities'
import type { Coordinates } from '../lib/geo'
import type { CurrentLocation } from '../lib/currentLocation'

type Step = 'name' | 'location' | 'equipment' | 'interests' | 'experience' | 'clubs' | 'notifications' | 'survey'

// Order follows the request that produced this flow. `name` stays first
// because the feed greets the user by name; `notifications` stays a permission
// ask after the questions; the survey is last so it's the thing they leave on.
//
// The gate's ONBOARDING_VERSION (lib/onboarding.ts) is the single source of
// truth for "how many steps this flow has" -- adding a step here and bumping
// that constant is what re-runs the flow for everyone who's already onboarded.
const STEPS: Step[] = ['name', 'location', 'equipment', 'interests', 'experience', 'clubs', 'notifications', 'survey']

// Local "get ready" reminders (localStorage + the browser's own Notification
// permission, see lib/getReadyReminders.ts) work for guests with no account
// at all -- only the optional cross-device server push sync needs sign-in.
// Checked separately from lib/push.ts's isPushSupported(), which also
// requires a service worker + VAPID key just for that sync layer.
const localNotificationsSupported = typeof window !== 'undefined' && 'Notification' in window

// Shown as the persisted home's name when a granted location can't be turned
// back into a place name (offline, or the geocoder is down). Better a home
// that survives the 30-day geo cache under a plain label than coordinates the
// user can't recognise, or no home at all.
const UNNAMED_HOME = 'Current location'

interface OnboardingFlowProps {
  city: CurrentLocation
  user: AuthUser | null
  setManualLocation?: (city: City | null) => void
  // Landing no longer asks for location up front (it's deferred to this
  // step specifically, so a first-time visitor sees what Atlas does before
  // any permission prompt) -- this is how that step actually triggers the
  // browser's own geolocation permission request, same as the old landing
  // page's "use my current location" button did.
  //
  // Returns the fix on success and null on denial/unsupported/failure. The
  // step has to know which happened before it replaces an existing home --
  // see handleUseCurrentLocation.
  requestLocation?: () => Promise<Coordinates | null>
  onDone: () => void
}

// First-run onboarding: name, home location, equipment, interests, experience,
// club membership, notifications, and a purpose survey. Each question is
// skippable and starts pre-filled from whatever's already saved, so this never
// re-asks for something the user already told Atlas via another surface
// (mobile's EventPreferencePrompt, the trip planner's equipment chips, etc).
export function OnboardingFlow({ city, user, setManualLocation, requestLocation, onDone }: OnboardingFlowProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [name, setName] = useState(() => getDisplayName() ?? '')
  const [interests, setInterests] = useState<string[]>([])
  const [hasSavedInterests, setHasSavedInterests] = useState(false)
  const [locationQuery, setLocationQuery] = useState('')
  const [chosenCity, setChosenCity] = useState<City | null>(null)
  const [locationBusy, setLocationBusy] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [equipment, setEquipment] = useState<string[]>(() => getOnboardingAnswers().viewingInstruments)
  const [experience, setExperience] = useState<ExperienceLevel | null>(() => getOnboardingAnswers().experienceLevel)
  const [surveyChoices, setSurveyChoices] = useState<string[]>([])
  const [pushBusy, setPushBusy] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushError, setPushError] = useState<string | null>(null)

  // Staged answers survive a mid-flow reload, so an interrupted run resumes
  // with the questions it already answered rather than blank. There is no
  // "was this answered" marker stored, so the club answer seeds from the only
  // evidence a prior answer leaves -- if neither the flag nor a name is set,
  // the question reads as unanswered (null) rather than asserting "No" on the
  // user's behalf.
  const [inClub, setInClub] = useState<boolean | null>(() => {
    const answers = getOnboardingAnswers()
    return answers.inAstroClub || answers.astroClubName ? true : null
  })
  const [clubName, setClubName] = useState(() => getOnboardingAnswers().astroClubName)

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

  // Fires on every step transition (including the first) so the funnel can
  // show view->advance vs. view->abandon per step, not just which steps were
  // ultimately completed.
  useEffect(() => {
    trackEvent('Onboarding step viewed', { step })
    // The survey's own `survey shown` is emitted separately (with $survey_id)
    // but hooked onto the same transition, so the two can't disagree about
    // whether the step was ever displayed.
    if (step === 'survey') reportOnboardingSurveyShown()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per step index change only
  }, [stepIndex])

  function finish() {
    markOnboardingComplete()
    // Signed-in accounts also get this persisted on the account itself (not
    // just this browser's localStorage) so a new device/browser doesn't get
    // sent through onboarding again just because it's never seen this flag.
    if (user) void syncOnboardingToAccount()
    trackEvent('Completed onboarding flow', { version: ONBOARDING_VERSION })
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

  function toggleEquipment(id: string) {
    setEquipment((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  function skipStep(step: Step) {
    trackEvent('Onboarding step skipped', { step })
    // Skipping equipment is still an answer to the first-plan journey's own
    // equipment prompt, which otherwise fires after the user next taps a
    // Tonight target -- without this they'd be asked the same question twice,
    // and the second asking would be the one that actually gets used.
    if (step === 'equipment') recordOnboardingEquipment([])
    advance()
  }

  async function handleNameContinue() {
    try {
      if (name.trim()) saveDisplayName(name)
    } catch {
      // Storage unavailable; the name is cosmetic, keep going.
    }
    trackEvent('Onboarding step advanced', { step: 'name', hasName: Boolean(name.trim()) })
    advance()
  }

  async function handleInterestsContinue() {
    // Always persist, even with zero interests picked -- otherwise skipping
    // this step leaves the completion flag unset and EventPreferencePrompt
    // re-shows on every dashboard visit.
    // A storage failure must never strand the button -- the picks are only a
    // preference, and the step has to advance regardless.
    try {
      await savePreferredEventTypes(interests)
    } catch {
      trackEvent('Onboarding step save failed', { step: 'interests' })
    }
    if (interests.length > 0) trackEvent('Set event preferences', { kinds: interests, source: 'onboarding' })
    trackEvent('Onboarding step advanced', { step: 'interests', interestCount: interests.length })
    advance()
  }

  function handleLocationContinue() {
    if (chosenCity) setManualLocation?.(chosenCity)
    trackEvent('Onboarding step advanced', { step: 'location', chosenLocation: Boolean(chosenCity) })
    advance()
  }

  // Grants a *durable* home, not just a 30-day rounded geo cache: the fix is
  // reverse-geocoded to a name and saved through the same manual-location
  // store the search path uses, so home survives the cache expiring. (Trips
  // still override it for exactly their dates -- lib/currentLocation.ts
  // resolves trip > manual > geo > default.)
  //
  // The ordering here is the whole point of awaiting the request: the previous
  // version cleared the stored home *before* the browser had answered, so a
  // denial destroyed the home the user already had, and a success never
  // persisted one in the first place.
  async function handleUseCurrentLocation() {
    if (!requestLocation || locationBusy) return
    trackEvent('Onboarding location: use current location clicked')
    setLocationBusy(true)
    setLocationError(null)
    try {
      const fix = await requestLocation()
      if (!fix) {
        // Denied, unsupported, or a concurrent request already in flight. Any
        // existing home is left exactly as it was; the user can search instead.
        setLocationError('We couldn’t get your location just now. Search for your town instead, or try again.')
        trackEvent('Onboarding location: use current location failed')
        return
      }
      let name: string | null = null
      try {
        name = await reverseGeocodeCity(fix.lat, fix.lon)
      } catch {
        // A geocoder failure must not cost the user their home -- see below.
      }
      // The device's own zone is the right one to attach here precisely
      // because the user is physically at this location right now, which the
      // old geo-only path couldn't say (it carried no timezone at all).
      const home: City = {
        name: name ?? UNNAMED_HOME,
        lat: fix.lat,
        lon: fix.lon,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }
      setManualLocation?.(home)
      setChosenCity(home)
      trackEvent('Onboarding step advanced', { step: 'location', chosenLocation: true, source: 'geolocation', named: Boolean(name) })
      advance()
    } finally {
      setLocationBusy(false)
    }
  }

  function handleEquipmentContinue() {
    saveOnboardingAnswers({ viewingInstruments: equipment })
    recordOnboardingEquipment(equipment)
    trackEvent('Onboarding step advanced', { step: 'equipment', instrumentCount: equipment.length })
    advance()
  }

  function handleExperienceContinue() {
    saveOnboardingAnswers({ experienceLevel: experience })
    trackEvent('Onboarding step advanced', { step: 'experience', answered: Boolean(experience) })
    advance()
  }

  function handleClubsContinue() {
    saveOnboardingAnswers({
      inAstroClub: inClub === true,
      // Trimmed and clipped to the field's 120-char limit here so the staged
      // answer and the account field can't disagree about what was typed.
      astroClubName: inClub ? clubName.trim().slice(0, 120) : '',
    })
    trackEvent('Onboarding step advanced', { step: 'clubs', inClub: inClub === true, named: Boolean(clubName.trim()) })
    advance()
  }

  // The step is reachable whether or not the survey is provisioned, so both
  // exits close the flow either way -- exactly one of them reports a response.
  function handleSurveyContinue() {
    if (surveyChoices.length > 0) {
      reportOnboardingSurveySubmitted(surveyChoices)
      trackEvent('Onboarding step advanced', { step: 'survey', choiceCount: surveyChoices.length })
    }
    finish()
  }

  function handleSurveySkip() {
    reportOnboardingSurveyDismissed()
    trackEvent('Onboarding step skipped', { step: 'survey' })
    finish()
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
      const message = err instanceof Error ? err.message : 'Could not enable notifications.'
      setPushError(message)
      trackEvent('Enable notifications failed', {
        source: 'onboarding',
        denied: 'Notification' in window && Notification.permission === 'denied',
        error: message,
      })
    } finally {
      setPushBusy(false)
      requestingPermissionRef.current = false
    }
  }

  const [theme] = useThemeState()

  // Split out of the JSX below because eight branches inline would put the
  // step bodies ~150 lines deep inside the overlay markup. Kept in this file
  // rather than a separate component on purpose: every branch reads two or
  // three pieces of local state, and threading a dozen callbacks and values
  // through a child would add a new way for a step to render stale answers.
  function renderStep() {
    switch (step) {
      case 'name':
        return (
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
        )

      case 'location':
        return (
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
              <button
                type="button"
                className="az-btn az-btn-outline az-btn-block"
                style={{ marginTop: '0.75rem' }}
                onClick={handleUseCurrentLocation}
                disabled={locationBusy}
              >
                {locationBusy ? 'Finding you…' : 'Use my current location'}
              </button>
            )}
            {locationError && (
              <p style={{ margin: '0.75rem 0 0', fontSize: '0.8125rem', color: 'var(--az-flagship)' }}>{locationError}</p>
            )}
          </>
        )

      case 'equipment':
        return <EquipmentStep selected={equipment} onToggle={toggleEquipment} />

      case 'interests':
        return (
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
        )

      case 'experience':
        return <ExperienceStep selected={experience} onSelect={setExperience} />

      case 'clubs':
        return (
          <ClubsStep
            inClub={inClub}
            clubName={clubName}
            onSelectInClub={setInClub}
            onClubNameChange={setClubName}
          />
        )

      case 'notifications':
        return (
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
        )

      case 'survey':
        return <SurveyStep selected={surveyChoices} onToggle={(choice) => setSurveyChoices((current) => (current.includes(choice) ? current.filter((item) => item !== choice) : [...current, choice]))} />
    }
  }

  function renderActions() {
    switch (step) {
      case 'name':
        return (
          <>
            <button type="button" className="az-text-btn" onClick={() => skipStep('name')}>
              Skip
            </button>
            <button type="button" className="az-btn az-btn-primary" style={{ flex: 1 }} onClick={handleNameContinue}>
              Continue
            </button>
          </>
        )

      // The geo path advances itself on a successful fix, so this button only
      // has to cover the search path and the skip.
      case 'location':
        return (
          <button
            type="button"
            className="az-btn az-btn-primary"
            style={{ flex: 1 }}
            onClick={chosenCity ? handleLocationContinue : () => skipStep('location')}
            disabled={locationBusy}
          >
            {chosenCity ? 'Use this location' : 'Looks good'}
          </button>
        )

      case 'equipment':
        return (
          <>
            <button type="button" className="az-text-btn" onClick={() => skipStep('equipment')}>
              Skip
            </button>
            <button type="button" className="az-btn az-btn-primary" style={{ flex: 1 }} onClick={handleEquipmentContinue}>
              Continue
            </button>
          </>
        )

      case 'interests':
        return (
          <>
            <button type="button" className="az-text-btn" onClick={() => skipStep('interests')}>
              Skip
            </button>
            <button type="button" className="az-btn az-btn-primary" style={{ flex: 1 }} onClick={handleInterestsContinue}>
              Continue
            </button>
          </>
        )

      case 'experience':
        return (
          <>
            <button type="button" className="az-text-btn" onClick={() => skipStep('experience')}>
              Skip
            </button>
            <button type="button" className="az-btn az-btn-primary" style={{ flex: 1 }} onClick={handleExperienceContinue}>
              Continue
            </button>
          </>
        )

      case 'clubs':
        return (
          <>
            <button type="button" className="az-text-btn" onClick={() => skipStep('clubs')}>
              Skip
            </button>
            <button type="button" className="az-btn az-btn-primary" style={{ flex: 1 }} onClick={handleClubsContinue}>
              Continue
            </button>
          </>
        )

      // Once notifications are on there's nothing left to decide here, so the
      // step collapses to a single Continue rather than offering "Done" and
      // "Continue" side by side doing the same thing.
      case 'notifications':
        if (pushEnabled) {
          return (
            <button type="button" className="az-btn az-btn-primary" style={{ flex: 1 }} onClick={advance}>
              Continue
            </button>
          )
        }
        return (
          <>
            <button type="button" className="az-text-btn" onClick={advance}>
              Not now
            </button>
            <button
              type="button"
              className="az-btn az-btn-primary"
              style={{ flex: 1 }}
              onClick={enableNotifications}
              disabled={pushBusy || !localNotificationsSupported}
            >
              {pushBusy ? 'Enabling…' : 'Enable notifications'}
            </button>
          </>
        )

      case 'survey':
        return (
          <>
            <button type="button" className="az-text-btn" onClick={handleSurveySkip}>
              Skip
            </button>
            <button type="button" className="az-btn az-btn-primary" style={{ flex: 1 }} onClick={handleSurveyContinue}>
              Finish
            </button>
          </>
        )
    }
  }

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

        {renderStep()}
      </div>

      <div style={{ position: 'relative', zIndex: 1, flex: 'none', display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
        {renderActions()}
      </div>
    </div>
  )
}
