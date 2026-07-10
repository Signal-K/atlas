import { useEffect, useMemo, useState } from 'react'
import { Starfield } from './components/Starfield'
import { applyTheme, getStoredTheme, getSystemTheme } from './lib/theme'
import { Sidebar, type View } from './components/Sidebar'
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
import { CITIES, findNearestCity } from './lib/cities'
import type { ObservationDraft } from './lib/observationDraft'
import './App.css'

const VIEW_SUBTITLE: Record<View, string> = {
  tonight: 'Is tonight worth going outside, and what to point your phone at.',
  dashboard: 'Sky events, calendar, watchlist, and weather — offline-first.',
  calendar: 'Browse the month and see what’s happening on any given day.',
  feed: 'Discoveries shared by sky-watchers.',
  archive: 'Events that have already happened.',
  scrapbook: 'Your own sky-watching notes.',
  challenges: 'Event-tied photo challenges, moderated before going public.',
  darksky: 'Nearby dark-sky sites, ranked by distance and light pollution.',
  planner: "Tonight's targets, ranked by how well they'll frame with your gear.",
  settings: 'Appearance, location, and motion.',
  ops: 'Local diagnostics for PocketBase, containers, and recent writes.',
}

function App() {
  const [view, setView] = useState<View>('tonight')
  const [accountDefaultMode, setAccountDefaultMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [observationDraft, setObservationDraft] = useState<ObservationDraft | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(() => localStorage.getItem(ONBOARDING_COMPLETE_KEY) !== '1')
  const location = useLocationSeed()
  const motion = useParallax()

  // Applied here (not just from SettingsView's own effect) so a stored
  // manual theme choice -- or just the system preference -- takes effect
  // from first paint instead of only after the user visits Settings once.
  useEffect(() => {
    applyTheme(getStoredTheme() ?? getSystemTheme())
  }, [])

  const defaultCity = useMemo(() => {
    if (location.coordinates) return findNearestCity(location.coordinates.lat, location.coordinates.lon)
    if (Intl.DateTimeFormat().resolvedOptions().timeZone === 'Australia/Melbourne') {
      return CITIES.find((city) => city.name === 'Melbourne') ?? CITIES[0]
    }
    return CITIES[0]
  }, [location.coordinates])

  function goToSignUp() {
    setAccountDefaultMode('sign-up')
    setView('settings')
  }

  function logAttempt(draft: ObservationDraft) {
    setObservationDraft(draft)
    setView('scrapbook')
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
            <TonightView key={defaultCity.name} city={defaultCity} locationStatus={location.status} onLogAttempt={logAttempt} />
          )}
          {view === 'dashboard' && (
            // Keyed so the location provider re-initializes once geolocation
            // resolves to a real nearest city (it starts as CITIES[0] before that).
            <DashboardView key={defaultCity.name} onSignUpClick={goToSignUp} defaultCity={defaultCity} />
          )}
          {view === 'calendar' && <CalendarView />}
          {view === 'feed' && <FeedView />}
          {view === 'archive' && <ArchiveView />}
          {view === 'scrapbook' && (
            <ScrapbookView draft={observationDraft} onDraftConsumed={() => setObservationDraft(null)} />
          )}
          {view === 'challenges' && <PhotoChallengesView />}
          {view === 'darksky' && <DarkSkyView key={defaultCity.name} lat={defaultCity.lat} lon={defaultCity.lon} />}
          {view === 'planner' && <DeepSkyPlannerView key={defaultCity.name} lat={defaultCity.lat} lon={defaultCity.lon} />}
          {view === 'ops' && <LocalOpsView />}
          {view === 'settings' && (
            <SettingsView
              locationStatus={location.status}
              requestLocation={location.requestLocation}
              needsMotionPermission={motion.needsMotionPermission}
              requestMotionPermission={motion.requestMotionPermission}
              accountDefaultMode={accountDefaultMode}
            />
          )}
        </main>
      </div>
    </>
  )
}

export default App
