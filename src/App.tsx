import { useMemo, useState } from 'react'
import { Starfield } from './components/Starfield'
import { Sidebar, type View } from './components/Sidebar'
import { OnboardingModal, ONBOARDING_COMPLETE_KEY } from './components/OnboardingModal'
import { DashboardView } from './views/DashboardView'
import { FeedView } from './views/FeedView'
import { ArchiveView } from './views/ArchiveView'
import { ScrapbookView } from './views/ScrapbookView'
import { SettingsView } from './views/SettingsView'
import { useLocationSeed } from './lib/geo'
import { useParallax } from './lib/motion'
import { CITIES, findNearestCity } from './lib/cities'
import './App.css'

const VIEW_SUBTITLE: Record<View, string> = {
  dashboard: 'Sky events, calendar, watchlist, and weather — offline-first.',
  feed: 'Discoveries shared by sky-watchers.',
  archive: 'Events that have already happened.',
  scrapbook: 'Your own sky-watching notes.',
  settings: 'Appearance, location, and motion.',
}

function App() {
  const [view, setView] = useState<View>('dashboard')
  const [accountDefaultMode, setAccountDefaultMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [showOnboarding, setShowOnboarding] = useState(() => localStorage.getItem(ONBOARDING_COMPLETE_KEY) !== '1')
  const location = useLocationSeed()
  const motion = useParallax()

  const defaultCity = useMemo(
    () => (location.coordinates ? findNearestCity(location.coordinates.lat, location.coordinates.lon) : CITIES[0]),
    [location.coordinates],
  )

  function goToSignUp() {
    setAccountDefaultMode('sign-up')
    setView('settings')
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
          {view === 'dashboard' && (
            // Keyed so the location provider re-initializes once geolocation
            // resolves to a real nearest city (it starts as CITIES[0] before that).
            <DashboardView key={defaultCity.name} onSignUpClick={goToSignUp} defaultCity={defaultCity} />
          )}
          {view === 'feed' && <FeedView />}
          {view === 'archive' && <ArchiveView />}
          {view === 'scrapbook' && <ScrapbookView />}
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
