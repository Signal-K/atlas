import { useState } from 'react'
import { Starfield } from './components/Starfield'
import { Sidebar, type View } from './components/Sidebar'
import { DashboardView } from './views/DashboardView'
import { ArchiveView } from './views/ArchiveView'
import { ScrapbookView } from './views/ScrapbookView'
import { SettingsView } from './views/SettingsView'
import { useLocationSeed } from './lib/geo'
import { useParallax } from './lib/motion'
import './App.css'

const VIEW_SUBTITLE: Record<View, string> = {
  dashboard: 'Sky events, calendar, watchlist, and weather — offline-first.',
  archive: 'Events that have already happened.',
  scrapbook: 'Your own sky-watching notes.',
  settings: 'Appearance, location, and motion.',
}

function App() {
  const [view, setView] = useState<View>('dashboard')
  const location = useLocationSeed()
  const motion = useParallax()

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
          {view === 'dashboard' && <DashboardView />}
          {view === 'archive' && <ArchiveView />}
          {view === 'scrapbook' && <ScrapbookView />}
          {view === 'settings' && (
            <SettingsView
              locationStatus={location.status}
              requestLocation={location.requestLocation}
              needsMotionPermission={motion.needsMotionPermission}
              requestMotionPermission={motion.requestMotionPermission}
            />
          )}
        </main>
      </div>
    </>
  )
}

export default App
