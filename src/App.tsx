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
import { EventCategoryPlanView } from './views/EventCategoryPlanView'
import { useLocationSeed } from './lib/geo'
import { useParallax } from './lib/motion'
import { MANUAL_LOCATION_KEY, useCurrentLocation } from './lib/currentLocation'
import { useAuth } from './lib/auth'
import { identifyAnalyticsUser } from './lib/analytics'
import { PaywallGate } from './components/PaywallGate'
import { FeedbackDock } from './components/FeedbackDock'
import { InstallPrompt } from './components/InstallPrompt'
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
  const alreadyEntered = user || localStorage.getItem(ENTERED_KEY) === '1'
  const hasManualLocation = localStorage.getItem(MANUAL_LOCATION_KEY) != null
  const [accountDefaultMode, setAccountDefaultMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [observationDraft, setObservationDraft] = useState<ObservationDraft | null>(null)
  // "History" defaults to the Archive tab, except right after logging an
  // attempt from Tonight, where it should open straight to Scrapbook --
  // see logAttempt below, and TabbedSection's defaultActiveId/key contract.
  const [historyDefaultTab, setHistoryDefaultTab] = useState<'archive' | 'scrapbook'>('archive')
  const location = useLocationSeed({ autoRequest: !!alreadyEntered && !hasManualLocation })
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
    identifyAnalyticsUser(user)
  }, [user])

  // Bare "/" lands on the default tab/view for whichever shell is active,
  // rewritten to a real route rather than staying un-bookmarkable -- but
  // only for visitors who've already been through (or skipped) the landing
  // page, otherwise this would redirect away before they ever see it.
  useEffect(() => {
    if (routerLocation.pathname === '/' && !isMobile && alreadyEntered) navigate(VIEW_PATH.tonight, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only redirect the bare landing path once isMobile/user is known
  }, [alreadyEntered, isMobile])

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
  // converting. Signed-in users and anyone who has already entered once
  // (flag persisted below) skip straight past this, same as before.
  const showLanding = routerLocation.pathname === '/' && !user && !alreadyEntered

  function enterApp() {
    localStorage.setItem(ENTERED_KEY, '1')
    navigate(isMobile ? '/today' : VIEW_PATH.tonight, { replace: true })
  }

  if (showLanding) {
    return (
      <LandingPage
        isMobile={isMobile}
        requestLocation={() => location.requestLocation(true)}
        setManualLocation={setManualLocation}
        onEnter={enterApp}
      />
    )
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
      </>
    )
  }

  return (
    <>
      <Starfield locationSeed={location.seed} targetRef={motion.targetRef} />
      <div className="app-shell">
        <Sidebar active={view} onSelect={setView} />
        <main className="dashboard">
          <header>
            <div className="dashboard-title">
              <h1>Atlas</h1>
            </div>
            <p className="dashboard-subtitle">{VIEW_SUBTITLE[view]}</p>
          </header>
          <hr className="hairline" />
          {view === 'tonight' && (
            <TonightView key={locationKey} city={currentLocation} locationStatus={location.status} onLogAttempt={logAttempt} />
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
              description="Rank dark-sky trips and deep-sky targets for your gear and upcoming events."
              onSignInClick={goToSignUp}
            >
              <TabbedSection
                tabs={[
                  {
                    id: 'events',
                    label: 'Event plan',
                    content: (
                      <EventCategoryPlanView
                        key={locationKey}
                        lat={currentLocation.lat}
                        lon={currentLocation.lon}
                        cityName={currentLocation.name}
                      />
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
