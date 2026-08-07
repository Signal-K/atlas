import { Navigate, Route, Routes } from 'react-router-dom'
import { NavShell, type NavItem } from './ui/NavShell'
import { DashboardIcon, EventsIcon, JournalIcon, PlanIcon, SettingsIcon } from './ui/icons'
import { DashboardPage } from './pages/DashboardPage'
import { EventsPage } from './pages/EventsPage'
import { PlanPage } from './pages/PlanPage'
import { JournalPage } from './pages/JournalPage'
import { SettingsPage, type SettingsPageProps } from './pages/SettingsPage'
import type { AuthUser } from './lib/auth'
import './ui/ui.css'

const NAV_ITEMS: NavItem[] = [
  { path: '/app/dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
  { path: '/app/events', label: 'Events', icon: <EventsIcon /> },
  { path: '/app/plan', label: 'Plan', icon: <PlanIcon /> },
  { path: '/app/journal', label: 'Journal', icon: <JournalIcon /> },
  { path: '/app/settings', label: 'Settings', icon: <SettingsIcon /> },
]

interface AppShellProps {
  user: AuthUser
  entitlementRefreshing: boolean
  onOpenSettings: () => void
  settingsProps: SettingsPageProps
}

/**
 * One responsive shell for the five app areas, replacing the old
 * Sidebar (desktop) / MobileShell (mobile) split and their two competing
 * CSS themes. Each area is still a placeholder page here (see KES-131
 * phases 4-8) -- this phase only wires up the shell and real routes.
 */
export function AppShell({ user, entitlementRefreshing, onOpenSettings, settingsProps }: AppShellProps) {
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
        <Route path="/app/dashboard" element={<DashboardPage />} />
        <Route path="/app/events" element={<EventsPage />} />
        <Route path="/app/plan" element={<PlanPage />} />
        <Route path="/app/journal" element={<JournalPage />} />
        <Route path="/app/settings" element={<SettingsPage {...settingsProps} />} />
        <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
      </Routes>
    </NavShell>
  )
}
