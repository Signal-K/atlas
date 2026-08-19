import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Starfield } from './components/Starfield'
import { useIsMobile } from './lib/useIsMobile'
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
import './App.css'

const APP_HOME = '/app/events'

function App() {
  const routerLocation = useLocation()
  const navigate = useNavigate()
  const isAppRoute = routerLocation.pathname.startsWith('/app')
  const { user, entitlementRefreshing } = useAuth()
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
  const isMobile = useIsMobile()
  const [observationDraft, setObservationDraft] = useState<ObservationDraft | null>(null)

  function logAttempt(draft: ObservationDraft) {
    setObservationDraft(draft)
    navigate('/app/journal')
  }

  useThemeBootstrap()
  useEntitlementSync()

  // Bare "/app" has no view of its own -- redirect to the app's home area,
  // same target enterApp() below uses right after onboarding.
  useEffect(() => {
    if (routerLocation.pathname === '/app') navigate(APP_HOME, { replace: true })
  }, [routerLocation.pathname, navigate])

  // Any path that isn't "/", "/landing", or under "/app" is not a real
  // route. Unknown public URLs resolve to the landing-page alias rather
  // than silently falling through to the app shell.
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
    return <LandingPage authenticatedEmail={user?.email} isMobile={isMobile} onEnter={enterApp} />
  }

  // Not "/", not "/landing", not an /app/* route -- the redirect effect
  // above is already sending this to "/"; render nothing in the meantime
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
        <Starfield locationSeed={location.seed} targetRef={motion.targetRef} />
        <AuthGate defaultMode={accountDefaultMode} onSignedIn={handleSignedIn} onSignedUp={handleSignedUp} />
        <DevPreviewPanel />
      </>
    )
  }

  // One shell for every viewport -- NavShell is responsive by itself (see
  // src/ui/ui.css), which is what replaces the old Sidebar/MobileShell
  // split and its two competing CSS themes.
  return (
    <>
      <Starfield locationSeed={location.seed} targetRef={motion.targetRef} />
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
        user={user}
        entitlementRefreshing={entitlementRefreshing}
        onOpenSettings={() => navigate('/app/settings')}
        currentLocation={currentLocation}
        onLogAttempt={logAttempt}
        journalProps={{ draft: observationDraft, onDraftConsumed: () => setObservationDraft(null), currentLocation }}
        settingsProps={{
          locationStatus: location.status,
          requestLocation: location.requestLocation,
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
