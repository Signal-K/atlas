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

function App() {
  const routerLocation = useLocation()
  const navigate = useNavigate()
  const isTonightRoute = routerLocation.pathname === '/tonight' || routerLocation.pathname.startsWith('/tonight/')
  const isAppRoute = routerLocation.pathname.startsWith('/app') || isTonightRoute
  const { user } = useAuth()
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

  if (showLanding) {
    return <LandingPage authenticatedEmail={user?.email} city={currentLocation} onEnter={enterApp} />
  }

  // Not "/", not "/landing", not a product route -- the redirect effect
  // above is already sending this to landing; render nothing in the meantime
  // rather than falling through to the app shell below.
  if (!isAppRoute) {
    return null
  }

  // "Get started" (or a direct link into /app/*) no longer drops a visitor
  // straight into onboarding/the app shell as a guest -- an account is
  // required before anything past this renders. Existing local-first data
  // (favourites/watchlist/observations saved before an account existed)
  // still gets merged in on sign-up via mergeLocalDataIntoAccount, same as
  // before; this just moves *when* that account has to exist.
  if (!user) {
    return (
      <>
        <AuthGate
          defaultMode={accountDefaultMode}
          onSignedIn={handleSignedIn}
          onSignedUp={handleSignedUp}
          currentLocation={currentLocation}
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
