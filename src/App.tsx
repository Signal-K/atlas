import { useEffect, useState } from 'react'
import { Starfield } from './components/Starfield'
import { applyTheme, getStoredTheme, getSystemTheme } from './lib/theme'
import { Sidebar, type View } from './components/Sidebar'
import { MobileShell } from './components/MobileShell'
import { useIsMobile } from './lib/useIsMobile'
import { TabbedSection } from './components/TabbedSection'
import { OnboardingModal, ONBOARDING_COMPLETE_KEY } from './components/OnboardingModal'
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
import { useLocationSeed } from './lib/geo'
import { useParallax } from './lib/motion'
import { useCurrentLocation } from './lib/currentLocation'
import type { ObservationDraft } from './lib/observationDraft'
import './App.css'

const VIEW_SUBTITLE: Record<View, string> = {
  tonight: 'Is tonight worth going outside, and what to point your phone at.',
  explore: 'Sky events, calendar, watchlist, and weather — offline-first.',
  plan: 'Dark-sky trips and deep-sky targets, ranked for your gear.',
  community: 'Discoveries shared by sky-watchers, and event-tied photo challenges.',
  history: 'Events that have already happened, and your own sky-watching notes.',
  settings: 'Appearance, location, motion, and local diagnostics.',
}

function App() {
  const [view, setView] = useState<View>('tonight')
  const [accountDefaultMode, setAccountDefaultMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [observationDraft, setObservationDraft] = useState<ObservationDraft | null>(null)
  // "History" defaults to the Archive tab, except right after logging an
  // attempt from Tonight, where it should open straight to Scrapbook --
  // see logAttempt below, and TabbedSection's defaultActiveId/key contract.
  const [historyDefaultTab, setHistoryDefaultTab] = useState<'archive' | 'scrapbook'>('archive')
  const [showOnboarding, setShowOnboarding] = useState(() => localStorage.getItem(ONBOARDING_COMPLETE_KEY) !== '1')
  const location = useLocationSeed()
  const motion = useParallax()
  const { current: currentLocation, manualCity, setManualLocation } = useCurrentLocation(location)
  const isMobile = useIsMobile()

  // Applied here (not just from SettingsView's own effect) so a stored
  // manual theme choice -- or just the system preference -- takes effect
  // from first paint instead of only after the user visits Settings once.
  useEffect(() => {
    applyTheme(getStoredTheme() ?? getSystemTheme())
  }, [])

  // Remounts location-dependent views once per real location change (a
  // GPS fix arriving, or a manual pick) without thrashing on every minor
  // GPS jitter -- rounded coordinates match the ~11km stability window
  // useLocationSeed already uses.
  const locationKey = `${currentLocation.source}:${currentLocation.lat.toFixed(1)},${currentLocation.lon.toFixed(1)}`

  function goToSignUp() {
    setAccountDefaultMode('sign-up')
    setView('settings')
  }

  function logAttempt(draft: ObservationDraft) {
    setObservationDraft(draft)
    setHistoryDefaultTab('scrapbook')
    setView('history')
  }

  if (isMobile) {
    return (
      <>
        <Starfield locationSeed={location.seed} targetRef={motion.targetRef} />
        {showOnboarding && <OnboardingModal onComplete={() => setShowOnboarding(false)} />}
        <MobileShell
          currentLocation={currentLocation}
          locationStatus={location.status}
          requestLocation={location.requestLocation}
          manualCity={manualCity}
          setManualLocation={setManualLocation}
          needsMotionPermission={motion.needsMotionPermission}
          requestMotionPermission={motion.requestMotionPermission}
        />
      </>
    )
  }

  return (
    <>
      <Starfield locationSeed={location.seed} targetRef={motion.targetRef} />
      {showOnboarding && <OnboardingModal onComplete={() => setShowOnboarding(false)} />}
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
                { id: 'calendar', label: 'Calendar', content: <CalendarView /> },
              ]}
            />
          )}
          {view === 'plan' && (
            <TabbedSection
              tabs={[
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
          )}
          {view === 'community' && (
            <TabbedSection
              tabs={[
                { id: 'feed', label: 'Feed', content: <FeedView /> },
                { id: 'challenges', label: 'Photo Challenges', content: <PhotoChallengesView /> },
              ]}
            />
          )}
          {view === 'history' && (
            <TabbedSection
              key={historyDefaultTab}
              defaultActiveId={historyDefaultTab}
              tabs={[
                { id: 'archive', label: 'Archive', content: <ArchiveView /> },
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
                { id: 'ops', label: 'Diagnostics', content: <LocalOpsView /> },
              ]}
            />
          )}
        </main>
      </div>
    </>
  )
}

export default App
