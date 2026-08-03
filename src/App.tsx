import { Suspense, lazy, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Starfield } from './components/Starfield'
import { applyTheme, getStoredTheme, getSystemTheme } from './lib/theme'
import { Sidebar, type View } from './components/Sidebar'
import { useIsMobile } from './lib/useIsMobile'
import { TabbedSection } from './components/TabbedSection'
import { LandingPage } from './views/LandingPage'
// Everything below the landing page is code-split: a first-time visitor
// lands on "/" and shouldn't have to download the mobile shell, every
// desktop view, and astronomy-engine before anything paints. Each view
// arrives as its own chunk when it's first rendered.
const MobileShell = lazy(() => import('./components/MobileShell').then((m) => ({ default: m.MobileShell })))
const TonightView = lazy(() => import('./views/TonightView').then((m) => ({ default: m.TonightView })))
const DashboardView = lazy(() => import('./views/DashboardView').then((m) => ({ default: m.DashboardView })))
const CalendarView = lazy(() => import('./views/CalendarView').then((m) => ({ default: m.CalendarView })))
const FeedView = lazy(() => import('./views/FeedView').then((m) => ({ default: m.FeedView })))
const ArchiveView = lazy(() => import('./views/ArchiveView').then((m) => ({ default: m.ArchiveView })))
const ScrapbookView = lazy(() => import('./views/ScrapbookView').then((m) => ({ default: m.ScrapbookView })))
const PhotoChallengesView = lazy(() =>
  import('./views/PhotoChallengesView').then((m) => ({ default: m.PhotoChallengesView })),
)
const SettingsView = lazy(() => import('./views/SettingsView').then((m) => ({ default: m.SettingsView })))
const LocalOpsView = lazy(() => import('./views/LocalOpsView').then((m) => ({ default: m.LocalOpsView })))
const DarkSkyView = lazy(() => import('./views/DarkSkyView').then((m) => ({ default: m.DarkSkyView })))
const DeepSkyPlannerView = lazy(() =>
  import('./views/DeepSkyPlannerView').then((m) => ({ default: m.DeepSkyPlannerView })),
)
const EventsView = lazy(() => import('./views/mobile/EventsView').then((m) => ({ default: m.EventsView })))
const PlanView = lazy(() => import('./views/mobile/PlanView').then((m) => ({ default: m.PlanView })))
import { useLocationSeed } from './lib/geo'
import { useParallax } from './lib/motion'
import { LOCATION_ESTABLISHED_KEY, MANUAL_LOCATION_KEY, useCurrentLocation } from './lib/currentLocation'
import { refreshEntitlement, refreshEntitlementAfterCheckout, useAuth } from './lib/auth'
import { identifyAnalyticsUser } from './lib/analytics'
import { captureDemoAccessCodeFromUrl } from './lib/demoAccess'
import { PaywallGate } from './components/PaywallGate'
import { FeedbackDock } from './components/FeedbackDock'
import { InstallPrompt } from './components/InstallPrompt'
import { OnboardingFlow, hasCompletedOnboardingFlow } from './components/OnboardingFlow'
import { OfflineBanner } from './components/OfflineBanner'
import { AuthGate } from './components/AuthGate'
import type { ObservationDraft } from './lib/observationDraft'
import './App.css'

// Real, bookmarkable/back-button-able routes per desktop view.
const VIEW_PATH: Record<View, string> = {
  tonight: '/app/tonight',
  explore: '/app/explore',
  plan: '/app/plan',
  community: '/app/community',
  history: '/app/history',
  settings: '/app/settings',
}

const PATH_VIEW: Record<string, View> = {
  '/app/tonight': 'tonight',
  '/app/explore': 'explore',
  '/app/plan': 'plan',
  '/app/community': 'community',
  '/app/history': 'history',
  '/app/settings': 'settings',
}

const VIEW_SUBTITLE: Record<View, string> = {
  tonight: 'Is tonight worth going outside, and what to point your phone at.',
  explore: 'Sky events, calendar, watchlist, and weather — offline-first.',
  plan: 'Dark-sky trips and deep-sky targets, with tips for whatever you’re shooting with.',
  community: 'Discoveries shared by sky-watchers, and event-tied photo challenges.',
  history: 'Events that have already happened, and your own sky-watching notes.',
  settings: 'Appearance, location, motion, and local diagnostics.',
}

// Set once a visitor either enters the app from the landing page or is
// already signed in, so `/` stops showing the landing page for them again
// on future visits (bookmarks/return traffic keep working as before).
const ENTERED_KEY = 'atlas-entered'

function App() {
  const routerLocation = useLocation()
  const navigate = useNavigate()
  const view = PATH_VIEW[routerLocation.pathname] ?? 'tonight'
  const { user, entitlementRefreshing } = useAuth()
  // Whether *this session* has clicked past the landing page at all --
  // keeps the app shell/onboarding flow visible immediately after
  // enterApp() navigates away from "/", the same as before. Kept
  // separate from hasPartiallyOnboarded below: right when someone clicks
  // "Get started," they haven't given a location or finished onboarding
  // yet, so gating onboarding's own visibility on that stricter signal
  // would hide onboarding the instant it's supposed to appear.
  const hasClickedIntoApp = user || localStorage.getItem(ENTERED_KEY) === '1'
  // Merely clicking "Get started" used to be enough to permanently skip
  // the landing page on every future visit -- so someone who clicked
  // through, then closed the tab without giving a location or touching
  // onboarding at all, would land straight back in the app shell next
  // time with nothing actually set up. This is the stricter signal that
  // decides whether landing reappears on a *fresh* visit to "/": clicked
  // in AND either given a real location (manual or geolocation) or gone
  // through the onboarding flow (finished or explicitly skipped -- both
  // still mean they engaged with it, not just bounced off the pitch).
  const hasLocationEstablished = localStorage.getItem(LOCATION_ESTABLISHED_KEY) === '1'
  const hasPartiallyOnboarded = hasClickedIntoApp && (hasLocationEstablished || hasCompletedOnboardingFlow())
  const skipLanding = user || hasPartiallyOnboarded
  const hasManualLocation = localStorage.getItem(MANUAL_LOCATION_KEY) != null
  const [accountDefaultMode, setAccountDefaultMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [observationDraft, setObservationDraft] = useState<ObservationDraft | null>(null)
  // "History" defaults to the Archive tab, except right after logging an
  // attempt from Tonight, where it should open straight to Scrapbook --
  // see logAttempt below, and TabbedSection's defaultActiveId/key contract.
  const [historyDefaultTab, setHistoryDefaultTab] = useState<'archive' | 'scrapbook'>('archive')
  const [onboardingFlowDismissed, setOnboardingFlowDismissed] = useState(() => hasCompletedOnboardingFlow())
  // Deferred until onboarding is out of the way: a first-time visitor who
  // just clicked "Get started" on the landing page shouldn't immediately
  // get an OS geolocation permission popup before they've even seen
  // OnboardingFlow's own "location" step (which offers the same "use my
  // current location" option, deliberately). Once onboarding is done
  // (finished or skipped) this reverts to the original behavior for anyone
  // who still hasn't set a location.
  const location = useLocationSeed({ autoRequest: hasClickedIntoApp && !hasManualLocation && onboardingFlowDismissed })
  const motion = useParallax()
  const { current: currentLocation, manualCity, setManualLocation } = useCurrentLocation(location)
  const isMobile = useIsMobile()

  // Applied here (not just from SettingsView's own effect) so a stored
  // manual theme choice -- or just the system preference -- takes effect
  // from first paint instead of only after the user visits Settings once.
  useEffect(() => {
    applyTheme(getStoredTheme() ?? getSystemTheme())
  }, [])

  useEffect(() => {
    captureDemoAccessCodeFromUrl()
  }, [])

  // Polar redirects back to `/?checkout={CHECKOUT_ID}` after a purchase, but
  // the `entitled` flag on the cached authStore record is only as fresh as
  // the last sign-in/refresh -- without this, users who complete checkout
  // and land anywhere but Settings (which independently refreshes on mount)
  // see the paywall as if nothing was purchased until they happen to open
  // Settings themselves. Strip the param after refreshing so it doesn't
  // re-trigger on every subsequent render/navigation.
  useEffect(() => {
    const params = new URLSearchParams(routerLocation.search)
    if (!params.has('checkout')) return
    params.delete('checkout')
    const search = params.toString()
    navigate({ pathname: routerLocation.pathname, search: search ? `?${search}` : '' }, { replace: true })
    void refreshEntitlementAfterCheckout()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the checkout param appearing
  }, [routerLocation.search])

  // Pick up server-side entitlement changes when a user returns to this tab
  // after completing checkout or an administrator reconciles a missed order.
  useEffect(() => {
    if (!user) return
    // Reconcile immediately on app load, not only after a later focus event.
    // A user who paid while an older Atlas build was active can otherwise
    // arrive directly on a gated route with a stale cached `entitled:false`
    // record and remain paywalled until they manually press "Check purchase".
    void refreshEntitlement()
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshEntitlement()
    }
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
    // `user` is a new object on every authStore change, including the
    // refreshEntitlement() call this effect itself triggers -- depending on
    // it re-fires the effect on every refresh, looping refreshEntitlement()
    // forever. Depend on the id so this only reruns on an actual sign-in/out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    identifyAnalyticsUser(user)
  }, [user])

  // "/" always renders the landing page -- see showLanding below -- so a
  // visitor who should skip it (signed in, or already partially onboarded)
  // is sent on to /app instead of the same URL silently rendering
  // different content depending on invisible local-storage state.
  useEffect(() => {
    if (routerLocation.pathname === '/' && skipLanding) navigate('/app', { replace: true })
  }, [routerLocation.pathname, skipLanding, navigate])

  // Bare "/app" has no view of its own -- redirect to whichever view/tab
  // this shell actually shows by default, same target enterApp() below
  // uses right after onboarding.
  useEffect(() => {
    if (routerLocation.pathname === '/app') navigate(isMobile ? '/app/today' : VIEW_PATH.tonight, { replace: true })
  }, [routerLocation.pathname, isMobile, navigate])

  // Any path that isn't "/", "/landing", or under "/app" is not a real
  // route -- it used to silently fall through to rendering the full app
  // shell (PATH_VIEW's `?? 'tonight'` fallback covered *anything*, not
  // just legitimate in-app paths). Sent to "/landing" specifically, not
  // "/": "/" has its own skip-to-/app redirect for already-onboarded
  // visitors right above, and routing an unknown path through "/" would
  // ride that same redirect straight into the app -- the exact "every
  // undefined route ends up being the app" behavior this is supposed to
  // stop. "/landing" carries no forwarding logic at all, so a bogus path
  // reliably dead-ends on the landing page no matter who's asking.
  const isAppRoute = routerLocation.pathname.startsWith('/app')
  useEffect(() => {
    if (routerLocation.pathname !== '/' && routerLocation.pathname !== '/landing' && !isAppRoute) {
      navigate('/landing', { replace: true })
    }
  }, [routerLocation.pathname, isAppRoute, navigate])

  // Remounts location-dependent views once per real location change (a
  // GPS fix arriving, or a manual pick) without thrashing on every minor
  // GPS jitter -- rounded coordinates match the ~11km stability window
  // useLocationSeed already uses.
  const locationKey = `${currentLocation.source}:${currentLocation.lat.toFixed(1)},${currentLocation.lon.toFixed(1)}`

  function setView(nextView: View) {
    navigate(VIEW_PATH[nextView])
  }

  function goToSignUp() {
    setAccountDefaultMode('sign-up')
    setView('settings')
  }

  function logAttempt(draft: ObservationDraft) {
    setObservationDraft(draft)
    setHistoryDefaultTab('scrapbook')
    setView('history')
  }

  // "/" is the landing page, full stop -- no sign-in or onboarding-state
  // check decides what renders at that URL. Signed-in/already-onboarded
  // visitors don't see it lingering, but that's the redirect effect above
  // moving them on to /app, not this page rendering something else in its
  // place. /landing is a permanent alias: always the landing page,
  // regardless of local storage, so it can actually be looked at on
  // demand.
  const showLanding = routerLocation.pathname === '/' || routerLocation.pathname === '/landing'
  const showOnboardingFlow = hasClickedIntoApp && isAppRoute && !onboardingFlowDismissed

  function enterApp() {
    localStorage.setItem(ENTERED_KEY, '1')
    setAccountDefaultMode('sign-up')
    navigate(isMobile ? '/app/today' : VIEW_PATH.tonight, { replace: true })
  }

  if (showLanding) {
    return <LandingPage isMobile={isMobile} onEnter={enterApp} />
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
        <AuthGate defaultMode={accountDefaultMode} />
      </>
    )
  }

  if (isMobile) {
    return (
      <>
        <Starfield locationSeed={location.seed} targetRef={motion.targetRef} />
        <OfflineBanner />
        <Suspense fallback={null}>
          <MobileShell
            currentLocation={currentLocation}
            locationStatus={location.status}
            requestLocation={location.requestLocation}
            manualCity={manualCity}
            setManualLocation={setManualLocation}
            needsMotionPermission={motion.needsMotionPermission}
            requestMotionPermission={motion.requestMotionPermission}
          />
        </Suspense>
        {!showOnboardingFlow && (
          <>
            <FeedbackDock />
            <InstallPrompt />
          </>
        )}
        {showOnboardingFlow && (
          <OnboardingFlow
            city={currentLocation}
            user={user}
            setManualLocation={setManualLocation}
            requestLocation={() => location.requestLocation(true)}
            onDone={() => setOnboardingFlowDismissed(true)}
          />
        )}
      </>
    )
  }

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
          onDone={() => setOnboardingFlowDismissed(true)}
        />
      )}
      <div className="app-shell">
        <Sidebar active={view} onSelect={setView} />
        <main className="dashboard">
          <header>
            <div className="dashboard-title">
              <h1>
                <img src="/atlas-icon.png" alt="" className="brand-mark brand-mark--desktop" />
                <span>Atlas</span>
              </h1>
              <button
                type="button"
                className={`desktop-pass-status${user?.entitled ? ' is-active' : ''}`}
                onClick={() => setView('settings')}
                aria-label={user?.entitled ? 'Sky Pass active — open account settings' : entitlementRefreshing ? 'Checking Sky Pass access' : 'Free account — view Sky Pass details'}
              >
                <span className="desktop-pass-status-dot" />
                {user?.entitled ? 'Sky Pass active' : entitlementRefreshing ? 'Checking access…' : 'Free'}
              </button>
            </div>
            <p className="dashboard-subtitle">{VIEW_SUBTITLE[view]}</p>
          </header>
          <hr className="hairline" />
          <Suspense fallback={null}>
          {view === 'tonight' && (
            <TonightView
              key={locationKey}
              city={currentLocation}
              locationStatus={location.status}
              onLogAttempt={logAttempt}
              setManualLocation={setManualLocation}
            />
          )}
          {view === 'explore' && (
            <TabbedSection
              tabs={[
                {
                  id: 'dashboard',
                  label: 'Today',
                  // Keyed so the location provider re-initializes once the
                  // real location (geolocation fix or manual pick) settles
                  // -- it starts as the Melbourne default before that.
                  content: <DashboardView key={locationKey} onSignUpClick={goToSignUp} defaultCity={currentLocation} />,
                },
                {
                  id: 'events',
                  label: 'Events',
                  content: (
                    <div className="mobile-shell desktop-feature-surface">
                      <EventsView city={currentLocation} onLogAttempt={logAttempt} />
                    </div>
                  ),
                },
                {
                  id: 'calendar',
                  label: 'Plan',
                  content: (
                    <PaywallGate
                      user={user}
                      entitlementRefreshing={entitlementRefreshing}
                      feature="The event calendar"
                      description="See sky events beyond tonight and plan ahead."
                      onSignInClick={goToSignUp}
                    >
                      <CalendarView />
                    </PaywallGate>
                  ),
                },
              ]}
            />
          )}
          {view === 'plan' && (
            <PaywallGate
              user={user}
              entitlementRefreshing={entitlementRefreshing}
              feature="Planning"
              description="Save targets, build a 90-day plan, and compare dark-sky trips with the Sky Pass."
              freeNote="Today, Events, check-ins, and your Journal stay free. Discounted users still need to complete Polar checkout first."
              onSignInClick={goToSignUp}
            >
              <TabbedSection
                tabs={[
                  {
                    id: 'workspace',
                    label: 'Plan workspace',
                    content: (
                      <div className="mobile-shell desktop-feature-surface">
                        <PlanView
                          key={locationKey}
                          city={currentLocation}
                          onOpenEvents={() => setView('explore')}
                          onLogAttempt={logAttempt}
                        />
                      </div>
                    ),
                  },
                  {
                    id: 'darksky',
                    label: 'Dark-sky trips',
                    content: <DarkSkyView key={locationKey} lat={currentLocation.lat} lon={currentLocation.lon} />,
                  },
                  {
                    id: 'planner',
                    label: 'Deep-sky planner',
                    content: <DeepSkyPlannerView key={locationKey} lat={currentLocation.lat} lon={currentLocation.lon} />,
                  },
                ]}
              />
            </PaywallGate>
          )}
          {view === 'community' && (
            <PaywallGate
              user={user}
              entitlementRefreshing={entitlementRefreshing}
              feature="Community"
              description="See discoveries shared by other sky-watchers and join event-tied photo challenges."
              onSignInClick={goToSignUp}
            >
              <TabbedSection
                tabs={[
                  { id: 'feed', label: 'Feed', content: <FeedView /> },
                  { id: 'challenges', label: 'Photo Challenges', content: <PhotoChallengesView /> },
                ]}
              />
            </PaywallGate>
          )}
          {view === 'history' && (
            <TabbedSection
              key={historyDefaultTab}
              defaultActiveId={historyDefaultTab}
              tabs={[
                {
                  id: 'archive',
                  label: 'Archive',
                  content: (
                    <PaywallGate
                      user={user}
                      entitlementRefreshing={entitlementRefreshing}
                      feature="The event archive"
                      description="Browse past sky events beyond tonight's."
                      onSignInClick={goToSignUp}
                    >
                      <ArchiveView />
                    </PaywallGate>
                  ),
                },
                {
                  id: 'scrapbook',
                  label: 'Scrapbook',
                  content: <ScrapbookView draft={observationDraft} onDraftConsumed={() => setObservationDraft(null)} />,
                },
              ]}
            />
          )}
          {view === 'settings' && (
            <TabbedSection
              tabs={[
                {
                  id: 'settings',
                  label: 'Settings',
                  content: (
                    <SettingsView
                      locationStatus={location.status}
                      requestLocation={location.requestLocation}
                      currentLocation={currentLocation}
                      manualCity={manualCity}
                      setManualLocation={setManualLocation}
                      needsMotionPermission={motion.needsMotionPermission}
                      requestMotionPermission={motion.requestMotionPermission}
                      accountDefaultMode={accountDefaultMode}
                    />
                  ),
                },
                ...(import.meta.env.DEV ? [{ id: 'ops', label: 'Diagnostics', content: <LocalOpsView /> }] : []),
              ]}
            />
          )}
          </Suspense>
        </main>
      </div>
      {!showOnboardingFlow && (
        <>
          <FeedbackDock />
          <InstallPrompt />
        </>
      )}
    </>
  )
}

export default App
