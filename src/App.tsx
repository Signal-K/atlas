import { useState } from 'react'
import { Starfield } from './components/Starfield'
import { Sidebar, type View } from './components/Sidebar'
import { DashboardView } from './views/DashboardView'
import { FeedView } from './views/FeedView'
import { ArchiveView } from './views/ArchiveView'
import { ScrapbookView } from './views/ScrapbookView'
import { SettingsView } from './views/SettingsView'
import { useLocationSeed } from './lib/geo'
import { useParallax } from './lib/motion'
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
  const location = useLocationSeed()
  const motion = useParallax()

  function goToSignUp() {
    setAccountDefaultMode('sign-up')
    setView('settings')
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
          {view === 'dashboard' && <DashboardView onSignUpClick={goToSignUp} />}
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
