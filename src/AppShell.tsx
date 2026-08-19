import { Navigate, Route, Routes } from 'react-router-dom'
import { NavShell, type NavItem } from './ui/NavShell'
import { EventsIcon, JournalIcon, SettingsIcon } from './ui/icons'
import { EventsPage } from './pages/EventsPage'
import { JournalPage, type JournalPageProps } from './pages/JournalPage'
import { AskAtlasPage } from './pages/AskAtlasPage'
import { SettingsPage, type SettingsPageProps } from './pages/SettingsPage'
import type { AuthUser } from './lib/auth'
import type { CurrentLocation } from './lib/currentLocation'
import type { ObservationDraft } from './lib/observationDraft'
import './ui/ui.css'

const NAV_ITEMS: NavItem[] = [
  { path: '/app/events', label: 'Events', icon: <EventsIcon /> },
  { path: '/app/journal', label: 'Journal', icon: <JournalIcon /> },
  { path: '/app/settings', label: 'Settings', icon: <SettingsIcon /> },
]

interface AppShellProps {
  user: AuthUser
  entitlementRefreshing: boolean
  onOpenSettings: () => void
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
  user,
  entitlementRefreshing,
  onOpenSettings,
  onLogAttempt,
  settingsProps,
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
        <Route path="/app/events" element={<EventsPage city={currentLocation} onLogAttempt={onLogAttempt} />} />
        {/* Planning was removed: Events is the single place to discover,
            save and prepare for an observation. Keep old deep links safe. */}
        <Route path="/app/plan" element={<Navigate to="/app/events" replace />} />
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
