import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { LandingPage } from './views/LandingPage'
import { AppShell } from './AppShell'
import { useParallax } from './lib/motion'
import { useAuth } from './lib/auth'
import { FeedbackDock } from './components/FeedbackDock'
import { InstallPrompt } from './components/InstallPrompt'
import { OnboardingFlow } from './components/OnboardingFlow'
import { OfflineBanner } from './components/OfflineBanner'
import { AuthGate } from './components/AuthGate'
import { DevPreviewPanel } from './components/DevPreviewPanel'
import { useThemeBootstrap } from './providers/useThemeBootstrap'
import { useEntitlementSync } from './providers/useEntitlementSync'
import { useOnboardingGate } from './providers/useOnboardingGate'
import { useAppLocation } from './providers/useAppLocation'
import type { ObservationDraft } from './lib/observationDraft'

const APP_HOME = '/app/hub'

// Routes a visitor can use without an account (ASV-47).
//
// Tonight's sky is the entire promise of the product, and it used to sit
// behind a signup form: every landing CTA -- including "Set your location" --
// navigated here and hit AuthGate, so the free tier's advertised "Tonight's
// plan for your location" was unreachable without registering, and anyone who
// declined got Melbourne's twilight times instead of their own.
//
// Hub is safe to open to guests because it is today-only and computed
// client-side from a location the browser already has; nothing on it needs a
// server-side identity. Everything that persists across devices (journal,
// watchlist, saved plans), costs money, or writes to the account stays gated.
const GUEST_ROUTES = new Set([APP_HOME])

function App() {
  const routerLocation = useLocation()
  const navigate = useNavigate()
  const isTonightRoute = routerLocation.pathname === '/tonight' || routerLocation.pathname.startsWith('/tonight/')
  const isAppRoute = routerLocation.pathname.startsWith('/app') || isTonightRoute
  const { user } = useAuth()
  const [showEntryChoice, setShowEntryChoice] = useState(false)
  const [accountDefaultMode, setAccountDefaultMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const {
    showOnboardingFlow,
    markEntered,
    handleSignedIn,
    handleSignedUp,
    dismissOnboardingFlow,
  } = useOnboardingGate({ user, isAppRoute })
  const { location, currentLocation, manualCity, setManualLocation } = useAppLocation()
  const motion = useParallax()
  const [observationDraft, setObservationDraft] = useState<ObservationDraft | null>(null)

  function logAttempt(draft: ObservationDraft) {
    setObservationDraft(draft)
    navigate('/app/journal')
  }

  useThemeBootstrap()
  useEntitlementSync()

  // Bare "/app" and the pre-rebuild "/tonight" alias have no view of their
  // own -- redirect to the app's home area, same target enterApp() below
  // uses right after onboarding. "/tonight" must stay a product route so
  // PostHog's replay URL trigger (app|tonight) can match signed-in use
  // instead of bouncing to the landing page.
  useEffect(() => {
    if (routerLocation.pathname === '/app' || isTonightRoute) navigate(APP_HOME, { replace: true })
  }, [routerLocation.pathname, isTonightRoute, navigate])

  // Any path that isn't "/", "/landing", "/tonight", or under "/app" is
  // not a real route. Unknown public URLs resolve to the landing-page alias
  // rather than silently falling through to the app shell.
  useEffect(() => {
    if (routerLocation.pathname !== '/' && routerLocation.pathname !== '/landing' && !isAppRoute) {
      navigate('/landing', { replace: true })
    }
  }, [routerLocation.pathname, isAppRoute, navigate])

  // "/" is the landing page, full stop. Signed-in visitors see their active
  // session identified here, but are only sent into the product when they
  // choose to open it. "/landing" remains a permanent alias.
  const showLanding = routerLocation.pathname === '/' || routerLocation.pathname === '/landing'

  function enterApp() {
    markEntered()
    setAccountDefaultMode('sign-up')
    navigate(APP_HOME, { replace: true })
  }

  function handleLandingEntry() {
    if (user) {
      enterApp()
      return
    }
    setShowEntryChoice(true)
  }

  function enterSignIn() {
    markEntered()
    setAccountDefaultMode('sign-in')
    setShowEntryChoice(false)
    navigate('/app/journal', { replace: true })
  }

  // ASV-51: the Sky Pass CTA must land somewhere that actually offers
  // checkout. /app/planner is already wrapped in PaywallGate, so a visitor
  // signs up (AuthGate gates any non-guest route) or, if already signed in,
  // goes straight to the working "Get Sky Pass" checkout button there --
  // instead of the free, guest-open Hub that enterApp() sends every other
  // CTA to.
  function enterPaidApp() {
    markEntered()
    setAccountDefaultMode('sign-up')
    navigate('/app/planner', { replace: true })
  }

  if (showLanding) {
    return (
      <>
        <LandingPage authenticatedEmail={user?.email} onEnter={handleLandingEntry} onEnterPaid={enterPaidApp} />
        {showEntryChoice && !user && (
          <div className="entry-choice-overlay" role="presentation">
            <section className="entry-choice-modal" role="dialog" aria-modal="true" aria-labelledby="entry-choice-title">
              <p className="entry-choice-kicker">Open Atlas</p>
              <h2 id="entry-choice-title">How would you like to begin?</h2>
              <p>Sign in to pick up your plans and journal, or take a look around first.</p>
              <div className="entry-choice-actions">
                <button type="button" className="am-btn am-btn-primary" onClick={enterSignIn}>
                  Sign in first
                </button>
                <button type="button" className="am-btn" onClick={() => { setShowEntryChoice(false); enterApp() }}>
                  View preview
                </button>
              </div>
              <button type="button" className="entry-choice-cancel" onClick={() => setShowEntryChoice(false)}>
                Not now
              </button>
            </section>
          </div>
        )}
      </>
    )
  }

  // Not "/", not "/landing", not a product route -- the redirect effect
  // above is already sending this to landing; render nothing in the meantime
  // rather than falling through to the app shell below.
  if (!isAppRoute) {
    return null
  }

  // Guests get Hub and nothing else. Any other product route still requires
  // an account before it renders. Local-first data (favourites/watchlist/
  // observations saved while browsing as a guest) is merged in on sign-up via
  // mergeLocalDataIntoAccount, so nothing gathered here is lost by waiting.
  if (!user && !GUEST_ROUTES.has(routerLocation.pathname)) {
    return (
      <>
        <AuthGate
          defaultMode={accountDefaultMode}
          onSignedIn={handleSignedIn}
          onSignedUp={handleSignedUp}
          currentLocation={currentLocation}
          // A guest who taps a locked tab came from Hub, not the landing
          // page -- send them back where they were rather than all the way
          // out of the product.
          backTo={APP_HOME}
          backLabel="Back to tonight"
        />
        <DevPreviewPanel />
      </>
    )
  }

  // One shell for every viewport -- NavShell is responsive by itself, with
  // the neutral headless baseline supplied by styles/headless.css.
  return (
    <>
      <OfflineBanner />
      {showOnboardingFlow && (
        <OnboardingFlow
          city={currentLocation}
          user={user}
          setManualLocation={setManualLocation}
          requestLocation={() => location.requestLocation(true)}
          onDone={dismissOnboardingFlow}
        />
      )}
      <AppShell
        currentLocation={currentLocation}
        onLogAttempt={logAttempt}
        journalProps={{ draft: observationDraft, onDraftConsumed: () => setObservationDraft(null), currentLocation }}
        profileProps={{
          locationStatus: location.status,
          // Force a fresh GPS fix here (never useLocationSeed's up-to-30-day
          // cache) -- this is the settings/profile "Use current location"
          // path, an explicit re-check the user reaches for specifically
          // because their real position has likely moved since the last
          // fix (ASV-35: reused a stale cached fix and silently stayed on
          // wherever that old fix was, e.g. Melbourne after moving to Perth).
          requestLocation: () => location.requestLocation(true),
          currentLocation,
          manualCity,
          setManualLocation,
          needsMotionPermission: motion.needsMotionPermission,
          requestMotionPermission: motion.requestMotionPermission,
          accountDefaultMode,
        }}
      />
      {!showOnboardingFlow && (
        <>
          <FeedbackDock />
          <InstallPrompt />
        </>
      )}
      <DevPreviewPanel />
    </>
  )
}

export default App
