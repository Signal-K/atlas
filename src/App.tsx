import { Suspense, lazy, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Starfield } from './components/Starfield'
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
const HubView = lazy(() => import('./views/mobile/HubView').then((m) => ({ default: m.HubView })))
const EntryDetailView = lazy(() => import('./views/mobile/EntryDetailView').then((m) => ({ default: m.EntryDetailView })))
const VisibleTonightView = lazy(() => import('./views/mobile/VisibleTonightView').then((m) => ({ default: m.VisibleTonightView })))
import { useParallax } from './lib/motion'
import { useAuth } from './lib/auth'
import { PaywallGate } from './components/PaywallGate'
import { FeedbackDock } from './components/FeedbackDock'
import { InstallPrompt } from './components/InstallPrompt'
import { OnboardingFlow } from './components/OnboardingFlow'
import { OfflineBanner } from './components/OfflineBanner'
import { AuthGate } from './components/AuthGate'
import { useThemeBootstrap } from './providers/useThemeBootstrap'
import { useEntitlementSync } from './providers/useEntitlementSync'
import { useOnboardingGate } from './providers/useOnboardingGate'
import { useAppLocation } from './providers/useAppLocation'
import type { ObservationDraft } from './lib/observationDraft'
import type { EntryDetailSubject } from './lib/entryDetail'
import type { EntryDetailActions } from './views/mobile/EntryDetailView'
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
  // HubView (reused for Explore's "Today" sub-tab, see below) opens the
  // full sky map at this path -- it must resolve back to 'explore', not
  // fall through to the generic 'tonight' default, or tapping the map
  // preview would silently kick the desktop view out of Explore entirely.
  '/app/sky-map': 'explore',
  // Same reasoning as '/app/sky-map' above -- HubView/EventsView/PlanView's
  // shared entry-detail overlay and the "visible tonight" screen both open
  // at these paths regardless of which Explore/Plan sub-tab triggered them.
  '/app/entry': 'explore',
  '/app/visible-tonight': 'explore',
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

function App() {
  const routerLocation = useLocation()
  const navigate = useNavigate()
  const isAppRoute = routerLocation.pathname.startsWith('/app')
  const view = PATH_VIEW[routerLocation.pathname] ?? 'tonight'
  const { user, entitlementRefreshing } = useAuth()
  const [accountDefaultMode, setAccountDefaultMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [observationDraft, setObservationDraft] = useState<ObservationDraft | null>(null)
  // "History" defaults to the Archive tab, except right after logging an
  // attempt from Tonight, where it should open straight to Scrapbook --
  // see logAttempt below, and TabbedSection's defaultActiveId/key contract.
  const [historyDefaultTab, setHistoryDefaultTab] = useState<'archive' | 'scrapbook'>('archive')
  const {
    hasClickedIntoApp,
    onboardingFlowDismissed,
    showOnboardingFlow,
    markEntered,
    handleSignedIn,
    handleSignedUp,
    dismissOnboardingFlow,
  } = useOnboardingGate({ user, isAppRoute })
  const { location, currentLocation, manualCity, setManualLocation, locationKey } = useAppLocation({
    isAppRoute,
    hasClickedIntoApp,
    onboardingFlowDismissed,
  })
  const motion = useParallax()
  const isMobile = useIsMobile()

  useThemeBootstrap()
  useEntitlementSync()

  // Bare "/app" has no view of its own -- redirect to whichever view/tab
  // this shell actually shows by default, same target enterApp() below
  // uses right after onboarding.
  useEffect(() => {
    if (routerLocation.pathname === '/app') navigate(isMobile ? '/app/today' : VIEW_PATH.tonight, { replace: true })
  }, [routerLocation.pathname, isMobile, navigate])

  // Any path that isn't "/", "/landing", or under "/app" is not a real
  // route. Unknown public URLs resolve to the landing-page alias rather
  // than silently falling through to the app shell.
  useEffect(() => {
    if (routerLocation.pathname !== '/' && routerLocation.pathname !== '/landing' && !isAppRoute) {
      navigate('/landing', { replace: true })
    }
  }, [routerLocation.pathname, isAppRoute, navigate])

  // Every top-level view that's ever been opened stays mounted (hidden via
  // CSS) afterward instead of unmounting -- rendering only the active
  // `view === 'x' && (...)` branch used to throw away and rebuild each
  // view's whole component tree (and its data loads) on every sidebar
  // click, which reads as the page reloading. Same fix as TabbedSection's
  // visitedIds and MobileShell's visitedTabs.
  const [visitedViews, setVisitedViews] = useState<Set<View>>(() => new Set([view]))
  useEffect(() => {
    setVisitedViews((current) => (current.has(view) ? current : new Set(current).add(view)))
  }, [view])

  // Which of Explore's own sub-tabs (Today/Events/Plan) is open -- lifted
  // up (rather than left as TabbedSection's own internal state) so
  // HubView's "Open events"/"Open plan" links, rendered as Explore's
  // "Today" content, can switch this group's sub-tab directly.
  const [exploreTab, setExploreTab] = useState<'dashboard' | 'events' | 'calendar'>('dashboard')

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

  // Desktop's Explore/Plan tabs reuse the mobile EventsView/PlanView
  // components directly (see the `.mobile-shell.desktop-feature-surface`
  // wrapper below) -- they need the same lifted entry-detail state
  // MobileShell provides, since router state can't hold callbacks.
  const [entryDetail, setEntryDetail] = useState<{ subject: EntryDetailSubject; actions?: EntryDetailActions; onLogAttempt: () => void } | null>(
    null,
  )
  const entryOpen = routerLocation.pathname === '/app/entry'
  const tonightOpen = routerLocation.pathname === '/app/visible-tonight'

  function openEntry(subject: EntryDetailSubject, actions?: EntryDetailActions) {
    setEntryDetail({
      subject,
      actions,
      onLogAttempt: () =>
        logAttempt({
          eventId: subject.id,
          targetName: subject.title,
          cameraRecipeUsed: subject.recipeKey ?? undefined,
          locationLabel: currentLocation.name,
          moonIlluminationPct: subject.moonPct ?? undefined,
          directionLabel: subject.direction?.compassLabel,
        }),
    })
    navigate('/app/entry')
  }

  useEffect(() => {
    if (!entryOpen) setEntryDetail(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only pathname should clear the lifted detail state
  }, [entryOpen])

  // "/" is the landing page, full stop. Signed-in visitors see their active
  // session identified here, but are only sent into the product when they
  // choose to open it. "/landing" remains a permanent alias.
  const showLanding = routerLocation.pathname === '/' || routerLocation.pathname === '/landing'

  function enterApp() {
    markEntered()
    setAccountDefaultMode('sign-up')
    navigate(isMobile ? '/app/today' : VIEW_PATH.tonight, { replace: true })
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
            onDone={dismissOnboardingFlow}
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
          onDone={dismissOnboardingFlow}
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
          {visitedViews.has('tonight') && (
            <div hidden={view !== 'tonight'}>
              <TonightView
                key={locationKey}
                city={currentLocation}
                locationStatus={location.status}
                onLogAttempt={logAttempt}
                setManualLocation={setManualLocation}
              />
            </div>
          )}
          {visitedViews.has('explore') && (
            <div hidden={view !== 'explore'}>
            <TabbedSection
              activeId={exploreTab}
              onActiveIdChange={(id) => setExploreTab(id as typeof exploreTab)}
              tabs={[
                {
                  id: 'dashboard',
                  label: 'Today',
                  content: (
                    <div className="mobile-shell desktop-feature-surface">
                      <HubView
                        key={locationKey}
                        city={currentLocation}
                        onOpenTab={(tab) => {
                          if (tab === 'events' || tab === 'calendar') setExploreTab(tab)
                        }}
                        onLogAttempt={logAttempt}
                        onOpenEntry={openEntry}
                        onOpenTonight={() => navigate('/app/visible-tonight')}
                      />
                    </div>
                  ),
                },
                {
                  id: 'events',
                  label: 'Events',
                  content: (
                    <div className="mobile-shell desktop-feature-surface">
                      <EventsView city={currentLocation} onOpenEntry={openEntry} />
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
            </div>
          )}
          {visitedViews.has('plan') && (
            <div hidden={view !== 'plan'}>
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
                          onOpenEntry={openEntry}
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
            </div>
          )}
          {visitedViews.has('community') && (
            <div hidden={view !== 'community'}>
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
            </div>
          )}
          {visitedViews.has('history') && (
            <div hidden={view !== 'history'}>
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
            </div>
          )}
          {visitedViews.has('settings') && (
            <div hidden={view !== 'settings'}>
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
            </div>
          )}
          </Suspense>
        </main>
      </div>
      {tonightOpen && (
        <div className="mobile-shell desktop-feature-surface desktop-entry-overlay">
          <Suspense fallback={null}>
            <VisibleTonightView city={currentLocation} onClose={() => navigate(-1)} onOpenEntry={(subject) => openEntry(subject)} />
          </Suspense>
        </div>
      )}
      {entryOpen && entryDetail && (
        <div className="mobile-shell desktop-feature-surface desktop-entry-overlay">
          <Suspense fallback={null}>
            <EntryDetailView
              subject={entryDetail.subject}
              actions={entryDetail.actions}
              onClose={() => navigate(-1)}
              onLogAttempt={entryDetail.onLogAttempt}
            />
          </Suspense>
        </div>
      )}
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
