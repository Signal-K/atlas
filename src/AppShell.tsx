import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { NavShell, type NavItem } from './ui/NavShell'
import { AccountIcon, EventsIcon } from './ui/icons'
import { ThemeToggle } from './ui/ThemeToggle'
import { EventsPage } from './pages/EventsPage'
import { AccountPage } from './pages/AccountPage'
import type { AuthUser } from './lib/auth'

const NAV_ITEMS: NavItem[] = [
  { path: '/app/events', label: 'Events', icon: <EventsIcon /> },
  { path: '/app/account', label: 'Account', icon: <AccountIcon /> },
]

interface AppShellProps {
  user: AuthUser
  entitlementRefreshing: boolean
}

// Just the skeleton: Events and Account are real pages, everything else in
// Atlas's eventual nav gets added here as its own route + NAV_ITEMS entry.
export function AppShell({ user, entitlementRefreshing }: AppShellProps) {
  return (
    <NavShell
      items={NAV_ITEMS}
      topBar={
        <div className="app-topbar">
          <div className="app-brand">
            <img src="/atlas-icon.png" alt="" width={24} height={24} />
            <span>Atlas</span>
          </div>
          <div className="app-topbar-actions">
            <ThemeToggle />
            <Link to="/app/account" className={`app-pass-status${user.entitled ? ' is-active' : ''}`}>
              {user.entitled ? 'Sky Pass active' : 'Free'}
            </Link>
          </div>
        </div>
      }
    >
      <Routes>
        <Route path="/app/events" element={<EventsPage />} />
        <Route path="/app/account" element={<AccountPage user={user} entitlementRefreshing={entitlementRefreshing} />} />
        <Route path="*" element={<Navigate to="/app/events" replace />} />
      </Routes>
    </NavShell>
  )
}
