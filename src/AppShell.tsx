import { Navigate, Route, Routes } from 'react-router-dom'
import { NavShell, type NavItem } from './ui/NavShell'
import { AskAtlasIcon, EventsIcon, JournalIcon, PlanIcon, SettingsIcon } from './ui/icons'
import type { DashboardPageProps } from './pages/DashboardPage'
import { EventsPage } from './pages/EventsPage'
import { PlanPage } from './pages/PlanPage'
import { JournalPage, type JournalPageProps } from './pages/JournalPage'
import { AskAtlasPage } from './pages/AskAtlasPage'
import { SettingsPage, type SettingsPageProps } from './pages/SettingsPage'
import type { AuthUser } from './lib/auth'
import type { CurrentLocation } from './lib/currentLocation'
import './ui/ui.css'

const NAV_ITEMS: NavItem[] = [
  { path: '/app/events', label: 'Events', icon: <EventsIcon /> },
  { path: '/app/plan', label: 'Plan', icon: <PlanIcon /> },
  { path: '/app/journal', label: 'Journal', icon: <JournalIcon /> },
  { path: '/app/ask', label: 'Ask Atlas', icon: <AskAtlasIcon /> },
  { path: '/app/settings', label: 'Settings', icon: <SettingsIcon /> },
]

interface AppShellProps {
  user: AuthUser
  entitlementRefreshing: boolean
  onOpenSettings: () => void
  settingsProps: SettingsPageProps
  dashboardProps: Omit<DashboardPageProps, 'currentLocation'>
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
  user,
  entitlementRefreshing,
  onOpenSettings,
  settingsProps,
  dashboardProps,
  journalProps,
  currentLocation,
}: AppShellProps) {
  const passLabel = user.entitled ? 'Sky Pass active' : entitlementRefreshing ? 'Checking access…' : 'Free'

  return (
    <NavShell
      items={NAV_ITEMS}
      topBar={
        <div className="app-topbar">
          <div className="app-brand">
            <img src="/atlas-icon.png" alt="" width={24} height={24} />
            <span>Atlas</span>
          </div>
          <button type="button" className={`app-pass-status${user.entitled ? ' is-active' : ''}`} onClick={onOpenSettings}>
            {passLabel}
          </button>
        </div>
      }
    >
      <Routes>
        <Route path="/app/events" element={<EventsPage city={currentLocation} />} />
        <Route path="/app/plan" element={<PlanPage currentLocation={currentLocation} onLogAttempt={dashboardProps.onLogAttempt} />} />
        <Route path="/app/journal" element={<JournalPage {...journalProps} />} />
        <Route path="/app/ask" element={<AskAtlasPage />} />
        <Route path="/app/settings" element={<SettingsPage {...settingsProps} />} />
        {/* Old Dashboard/sky-map links redirect to the new home instead of
            404ing or leaving a dead route mounted. */}
        <Route path="*" element={<Navigate to="/app/events" replace />} />
      </Routes>
    </NavShell>
  )
}
