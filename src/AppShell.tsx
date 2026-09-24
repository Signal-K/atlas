import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { NavShell, type NavItem } from './ui/NavShell'
import { TopBar } from './ui/TopBar'
import { MobileIcon } from './components/mobile/MobileIcon'
import { ToastProvider } from './components/mobile/Toast'
import { LocationSheet } from './components/mobile/LocationSheet'
import { MobileNavDrawer } from './components/mobile/MobileNavDrawer'
import { SearchOverlay } from './components/mobile/SearchOverlay'
import { HubPage } from './pages/HubPage'
import { EventsPage } from './pages/EventsPage'
import { CalendarPage } from './pages/CalendarPage'
import { PlannerPage } from './pages/PlannerPage'
import { JournalPage, type JournalPageProps } from './pages/JournalPage'
import { AskAtlasPage } from './pages/AskAtlasPage'
import { ProfilePage, type ProfilePageProps } from './pages/ProfilePage'
import { useThemeState } from './lib/theme'
import { useAuth } from './lib/auth'
import type { CurrentLocation } from './lib/currentLocation'
import type { ObservationDraft } from './lib/observationDraft'

const NAV_ITEMS: NavItem[] = [
  { path: '/app/hub', label: 'Hub', icon: <MobileIcon name="sparkle" /> },
  { path: '/app/events', label: 'All events', icon: <MobileIcon name="calendar" /> },
  { path: '/app/calendar', label: 'Calendar', icon: <MobileIcon name="calendar" /> },
  { path: '/app/planner', label: 'Planner', icon: <MobileIcon name="route" /> },
  { path: '/app/journal', label: 'Journal', icon: <MobileIcon name="journal" /> },
  { path: '/app/ask', label: 'Ask Atlas', icon: <MobileIcon name="sparkle" /> },
  { path: '/app/profile', label: 'You', icon: <MobileIcon name="person" /> },
]

// ASV-47: Hub is the only area a guest can open, so mark the rest rather
// than letting a tap land on an unannounced signup form.
function navItemsFor(signedIn: boolean): NavItem[] {
  if (signedIn) return NAV_ITEMS
  return NAV_ITEMS.map((item) => (item.path === '/app/hub' ? item : { ...item, locked: true }))
}

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
 * Journal, Profile. Search is not a tab; it's a full-screen overlay opened
 * from the TopBar's search icon, reachable from every area. The TopBar
 * (nav drawer trigger, location chip, search, theme toggle) and the
 * Location sheet are mounted once here rather than per-page, since every
 * area shares them.
 *
 * Primary nav is a side rail on wide viewports and a hamburger + slide-in
 * drawer on narrow ones (MobileNavDrawer) -- a deliberate divergence from
 * the Atlas Mobile Claude Design canvas, which specifies a persistent
 * bottom tab bar. That bar had a recurring, unfixed-by-rewrites WebKit
 * glitch in the installed PWA (phantom keyboard-avoidance space opening
 * under it on tap); this is a product decision to move off it rather than
 * chase the platform bug further. See AppTabBar's git history before
 * reintroducing a persistent bottom bar here.
 */
export function AppShell({ onLogAttempt, profileProps, journalProps, currentLocation }: AppShellProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [theme, toggleTheme] = useThemeState()
  const [locationSheetOpen, setLocationSheetOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [navDrawerOpen, setNavDrawerOpen] = useState(false)
  const navItems = navItemsFor(Boolean(user))

  // The desktop search affordance advertises its shortcut, so keep the
  // command useful as well as visible. Avoid stealing a browser/editor
  // shortcut while the person is already typing into a control.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) return
      const target = event.target as HTMLElement | null
      if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? '')) return
      event.preventDefault()
      setSearchOpen(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <ToastProvider>
      <ScrollToTop />
      <NavShell
        items={navItems}
        dark={theme === 'dark'}
        topBar={
          <TopBar
            locationName={currentLocation.name}
            onOpenLocation={() => setLocationSheetOpen(true)}
            onOpenSearch={() => setSearchOpen(true)}
            theme={theme}
            onToggleTheme={toggleTheme}
            navDrawerOpen={navDrawerOpen}
            onOpenNavDrawer={() => setNavDrawerOpen(true)}
          />
        }
      >
        {!user && (
          // Guests see tonight's sky without an account (ASV-47). This says
          // what an account adds rather than blocking the view to ask for one.
          <div className="guest-strip">
            <span>
              You're browsing as a guest. Tonight's sky is free — an account keeps your journal, watchlist and
              reminders.
            </span>
            <button type="button" className="guest-strip-cta" onClick={() => navigate('/app/journal')}>
              Create a free account
            </button>
          </div>
        )}
        <Routes>
          <Route path="/app/hub" element={<HubPage city={currentLocation} onLogAttempt={onLogAttempt} onRequestLocation={() => void profileProps.requestLocation()} />} />
          <Route path="/app/events" element={<EventsPage city={currentLocation} onLogAttempt={onLogAttempt} />} />
          <Route path="/app/calendar" element={<CalendarPage city={currentLocation} />} />
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

      <MobileNavDrawer items={navItems} open={navDrawerOpen} onClose={() => setNavDrawerOpen(false)} />

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
        entitled={Boolean(user?.entitled)}
        onUpgrade={() => {
          setLocationSheetOpen(false)
          navigate('/app/profile')
        }}
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
