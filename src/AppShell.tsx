import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { NavShell, type NavItem } from './ui/NavShell'
import { EventsIcon, JournalIcon, PlanIcon, SearchIcon, SettingsIcon } from './ui/icons'
import { EventsPage } from './pages/EventsPage'
import { JournalPage, type JournalPageProps } from './pages/JournalPage'
import { PlanPage } from './pages/PlanPage'
import { AskAtlasPage } from './pages/AskAtlasPage'
import { SearchPage } from './pages/SearchPage'
import { SettingsPage, type SettingsPageProps } from './pages/SettingsPage'
import type { CurrentLocation } from './lib/currentLocation'
import type { ObservationDraft } from './lib/observationDraft'

const NAV_ITEMS: NavItem[] = [
  { path: '/app/events', label: 'Events', icon: <EventsIcon /> },
  { path: '/app/search', label: 'Explore', icon: <SearchIcon /> },
  { path: '/app/plan', label: 'Plan', icon: <PlanIcon /> },
  { path: '/app/journal', label: 'Journal', icon: <JournalIcon /> },
  { path: '/app/settings', label: 'Settings', icon: <SettingsIcon /> },
]

// Mirrors each page's own <h1>, so the mobile topbar can show the page
// title in place of the vertical space a full page-header would take.
const PAGE_TITLES: Record<string, string> = {
  '/app/events': 'Events',
  '/app/search': 'Explore',
  '/app/plan': 'Plan',
  '/app/journal': 'Journal',
  '/app/ask': 'Ask Atlas',
  '/app/settings': 'Settings',
}

interface AppShellProps {
  onLogAttempt: (draft: ObservationDraft) => void
  settingsProps: SettingsPageProps
  journalProps: JournalPageProps
  currentLocation: CurrentLocation
}

/**
 * One responsive shell for the app's areas, replacing the old
 * Sidebar (desktop) / MobileShell (mobile) split and their two competing
 * CSS themes. Dashboard was removed (its Tonight/major-events content now
 * lives on Events, the app's home) -- see KES-131.
 */
export function AppShell({
  onLogAttempt,
  settingsProps,
  journalProps,
  currentLocation,
}: AppShellProps) {
  const location = useLocation()
  const pageTitle = PAGE_TITLES[location.pathname]
  // Events (the app's home) builds its own complete header -- location
  // switcher, instrument toggle, moon phase, time -- so it doesn't need this
  // generic wordmark bar stacked on top of it. Every other page still relies
  // on this for its title until it gets a real header of its own.
  const showGenericTopBar = location.pathname !== '/app/events'

  return (
    <NavShell
      items={NAV_ITEMS}
      topBar={
        showGenericTopBar ? (
          <div className="app-topbar">
            {pageTitle && <span className="app-page-title">{pageTitle}</span>}
          </div>
        ) : undefined
      }
    >
      <Routes>
        <Route path="/app/events" element={<EventsPage city={currentLocation} onLogAttempt={onLogAttempt} />} />
        {/* Sky Pass multi-city trip planner. PaywallGate inside
            PlanPage/PlanTripView handles the free-account paywall. */}
        <Route path="/app/plan" element={<PlanPage />} />
        <Route path="/app/search" element={<SearchPage city={currentLocation} onLogAttempt={onLogAttempt} />} />
        <Route path="/app/journal" element={<JournalPage {...journalProps} />} />
        <Route path="/app/ask" element={<AskAtlasPage />} />
        <Route path="/app/settings" element={<SettingsPage {...settingsProps} />} />
        <Route path="/app/dashboard" element={<Navigate to="/app/events" replace />} />
        {/* Legacy sky-map links redirect to Events, the merged app home. */}
        <Route path="*" element={<Navigate to="/app/events" replace />} />
      </Routes>
    </NavShell>
  )
}
