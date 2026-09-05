import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { NavShell, type NavItem } from './ui/NavShell'
import { TopBar } from './ui/TopBar'
import { MobileIcon } from './components/mobile/MobileIcon'
import { ToastProvider } from './components/mobile/Toast'
import { LocationSheet } from './components/mobile/LocationSheet'
import { SearchOverlay } from './components/mobile/SearchOverlay'
import { HubPage } from './pages/HubPage'
import { EventsPage } from './pages/EventsPage'
import { PlannerPage } from './pages/PlannerPage'
import { JournalPage, type JournalPageProps } from './pages/JournalPage'
import { AskAtlasPage } from './pages/AskAtlasPage'
import { ProfilePage, type ProfilePageProps } from './pages/ProfilePage'
import { useThemeState } from './lib/theme'
import type { CurrentLocation } from './lib/currentLocation'
import type { ObservationDraft } from './lib/observationDraft'

const NAV_ITEMS: NavItem[] = [
  { path: '/app/hub', label: 'Hub', icon: <MobileIcon name="sparkle" /> },
  { path: '/app/events', label: 'Events', icon: <MobileIcon name="calendar" /> },
  { path: '/app/planner', label: 'Planner', icon: <MobileIcon name="route" /> },
  { path: '/app/journal', label: 'Journal', icon: <MobileIcon name="journal" /> },
  { path: '/app/profile', label: 'You', icon: <MobileIcon name="person" /> },
]

interface AppShellProps {
  onLogAttempt: (draft: ObservationDraft) => void
  profileProps: Omit<ProfilePageProps, 'onOpenLocation'>
  journalProps: JournalPageProps
  currentLocation: CurrentLocation
}

// The tab bar is position:fixed, so it never moves -- but nothing here
// ever told the window to scroll back to the top on tab switches. Land on
// Events scrolled halfway down, tap over to Planner, and the browser kept
// that same scroll offset: Planner's own heading and hero card render
// above it, off the top of the screen, and whatever content sits at that
// leftover scroll depth is what's visible instead. That reads as "the
// whole screen jumped up" the moment you tap a tab.
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

/**
 * One responsive shell for the app's areas: Hub (home), Events, Planner,
 * Journal, Profile -- the tab structure of the Atlas Mobile Claude Design
 * kit. Search is not a tab; it's a full-screen overlay opened from the
 * TopBar's search icon, reachable from every tab. The TopBar (location
 * chip, search, theme toggle) and the Location sheet are mounted once here
 * rather than per-page, since every tab shares them.
 */
export function AppShell({ onLogAttempt, profileProps, journalProps, currentLocation }: AppShellProps) {
  const navigate = useNavigate()
  const [theme, toggleTheme] = useThemeState()
  const [locationSheetOpen, setLocationSheetOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <ToastProvider>
      <ScrollToTop />
      <NavShell
        items={NAV_ITEMS}
        dark={theme === 'dark'}
        topBar={
          <TopBar
            locationName={currentLocation.name}
            onOpenLocation={() => setLocationSheetOpen(true)}
            onOpenSearch={() => setSearchOpen(true)}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        }
      >
        <Routes>
          <Route path="/app/hub" element={<HubPage city={currentLocation} onLogAttempt={onLogAttempt} />} />
          <Route path="/app/events" element={<EventsPage city={currentLocation} onLogAttempt={onLogAttempt} />} />
          <Route path="/app/planner" element={<PlannerPage />} />
          <Route path="/app/journal" element={<JournalPage {...journalProps} />} />
          <Route path="/app/ask" element={<AskAtlasPage />} />
          <Route path="/app/profile" element={<ProfilePage {...profileProps} onOpenLocation={() => setLocationSheetOpen(true)} />} />
          {/* Legacy paths from the pre-redesign tab structure. */}
          <Route path="/app/plan" element={<Navigate to="/app/planner" replace />} />
          <Route path="/app/settings" element={<Navigate to="/app/profile" replace />} />
          <Route path="/app/search" element={<Navigate to="/app/hub" replace />} />
          <Route path="/app/dashboard" element={<Navigate to="/app/hub" replace />} />
          <Route path="*" element={<Navigate to="/app/hub" replace />} />
        </Routes>
      </NavShell>

      <LocationSheet
        open={locationSheetOpen}
        onClose={() => setLocationSheetOpen(false)}
        locationStatus={profileProps.locationStatus}
        requestLocation={profileProps.requestLocation}
        currentLocation={currentLocation}
        manualCity={profileProps.manualCity}
        setManualLocation={profileProps.setManualLocation}
        needsMotionPermission={profileProps.needsMotionPermission}
        requestMotionPermission={profileProps.requestMotionPermission}
      />

      {searchOpen && (
        <SearchOverlay
          city={currentLocation}
          onClose={() => setSearchOpen(false)}
          onLogAttempt={onLogAttempt}
          onNavigateToJournal={() => {
            setSearchOpen(false)
            navigate('/app/journal')
          }}
        />
      )}
    </ToastProvider>
  )
}
