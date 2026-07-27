import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Starfield } from './components/Starfield'
import { applyTheme, getStoredTheme, getSystemTheme } from './lib/theme'
import { Sidebar, type View } from './components/Sidebar'
import { MobileShell } from './components/MobileShell'
import { useIsMobile } from './lib/useIsMobile'
import { TabbedSection } from './components/TabbedSection'
import { LandingPage } from './views/LandingPage'
import { TonightView } from './views/TonightView'
import { DashboardView } from './views/DashboardView'
import { CalendarView } from './views/CalendarView'
import { FeedView } from './views/FeedView'
import { ArchiveView } from './views/ArchiveView'
import { ScrapbookView } from './views/ScrapbookView'
import { PhotoChallengesView } from './views/PhotoChallengesView'
import { SettingsView } from './views/SettingsView'
import { LocalOpsView } from './views/LocalOpsView'
import { DarkSkyView } from './views/DarkSkyView'
import { DeepSkyPlannerView } from './views/DeepSkyPlannerView'
import { EventsView } from './views/mobile/EventsView'
import { PlanView } from './views/mobile/PlanView'
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
import type { ObservationDraft } from './lib/observationDraft'
import './App.css'

// Real, bookmarkable/back-button-able routes per desktop view.
const VIEW_PATH: Record<View, string> = {
  tonight: '/tonight',
  explore: '/explore',
  plan: '/plan',
  community: '/community',
  history: '/history',
  settings: '/settings',
}

const PATH_VIEW: Record<string, View> = {
  '/tonight': 'tonight',
  '/explore': 'explore',
  '/plan': 'plan',
  '/community': 'community',
  '/history': 'history',
  '/settings': 'settings',
}

const VIEW_SUBTITLE: Record<View, string> = {
  tonight: 'Is tonight worth going outside, and what to point your phone at.',
  explore: 'Sky events, calendar, watchlist, and weather — offline-first.',
  plan: 'Dark-sky trips and deep-sky targets, ranked for your gear.',
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
  const { user } = useAuth()
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

  // Bare "/" lands on the default tab/view for whichever shell is active,
  // rewritten to a real route rather than staying un-bookmarkable -- but
  // only for visitors who've already been through (or skipped) the landing
  // page, otherwise this would redirect away before they ever see it.
  useEffect(() => {
    if (routerLocation.pathname === '/' && !isMobile && skipLanding) navigate(VIEW_PATH.tonight, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only redirect the bare landing path once isMobile/user is known
  }, [skipLanding, isMobile])

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

  // First-time/unauthenticated visitors at "/" see the landing page instead
  // of being dropped straight into the full app shell -- see market
  // validation notes on why the previous "/" -> app redirect wasn't
  // converting. Signed-in users and anyone who has actually engaged with
  // onboarding (not just clicked through once) skip straight past this.
  const showLanding = routerLocation.pathname === '/' && !skipLanding
  const showOnboardingFlow = hasClickedIntoApp && !showLanding && !onboardingFlowDismissed

  function enterApp() {
    localStorage.setItem(ENTERED_KEY, '1')
    navigate(isMobile ? '/today' : VIEW_PATH.tonight, { replace: true })
  }

  // /landing always renders the landing page, full stop -- no sign-in or
  // onboarding-state check of any kind. This exists purely so it can
  // actually be looked at on demand, regardless of what this browser's
  // local storage already says about a prior visit.
  if (showLanding || routerLocation.pathname === '/landing') {
    return <LandingPage isMobile={isMobile} onEnter={enterApp} />
  }

  if (isMobile) {
    return (
      <>
        <Starfield locationSeed={location.seed} targetRef={motion.targetRef} />
        <MobileShell
          currentLocation={currentLocation}
          locationStatus={location.status}
          requestLocation={location.requestLocation}
          manualCity={manualCity}
          setManualLocation={setManualLocation}
          needsMotionPermission={motion.needsMotionPermission}
          requestMotionPermission={motion.requestMotionPermission}
        />
        <FeedbackDock />
        <InstallPrompt />
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
                aria-label={user?.entitled ? 'Sky Pass active — open account settings' : 'Free account — view Sky Pass details'}
              >
                <span className="desktop-pass-status-dot" />
                {user?.entitled ? 'Sky Pass active' : 'Free'}
              </button>
            </div>
            <p className="dashboard-subtitle">{VIEW_SUBTITLE[view]}</p>
          </header>
          <hr className="hairline" />
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
                  label: 'Dashboard',
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
                  label: 'Calendar',
                  content: (
                    <PaywallGate
                      user={user}
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
              feature="Planning"
              description="Build observing plans, compare dark-sky trips, save events, and prepare gear with the Sky Pass."
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
        </main>
      </div>
      <FeedbackDock />
      <InstallPrompt />
    </>
  )
}

export default App
