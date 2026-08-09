import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { NavShell, type NavItem } from './ui/NavShell'
import { AccountIcon, CalendarIcon, EventsIcon, MoonIcon } from './ui/icons'
import { ThemeToggle } from './ui/ThemeToggle'
import { EventsPage } from './pages/EventsPage'
import { EventDetailPage } from './pages/EventDetailPage'
import { EventArchivePage } from './pages/EventArchivePage'
import { ConditionsPage } from './pages/ConditionsPage'
import { CalendarPage } from './pages/CalendarPage'
import { AccountPage } from './pages/AccountPage'
import type { AuthUser } from './lib/auth'
import { effectiveEntitled, useFreeOverride } from './lib/previewMode'

const NAV_ITEMS: NavItem[] = [
  { path: '/app/events', label: 'Events', icon: <EventsIcon /> },
  { path: '/app/calendar', label: 'Calendar', icon: <CalendarIcon /> },
  { path: '/app/conditions', label: 'Conditions', icon: <MoonIcon /> },
  { path: '/app/account', label: 'Account', icon: <AccountIcon /> },
]

interface AppShellProps {
  user: AuthUser
  entitlementRefreshing: boolean
}

// Just the skeleton: Events, Conditions, and Account are real pages,
// everything else in Atlas's eventual nav gets added here as its own route
// + NAV_ITEMS entry.
export function AppShell({ user, entitlementRefreshing }: AppShellProps) {
  // The preview-deployment free-tier toggle (Account page) overrides how
  // `entitled` renders everywhere in the app without touching the real,
  // server-side value -- see lib/previewMode.ts.
  useFreeOverride()
  const entitled = effectiveEntitled(user.entitled)
  const effectiveUser: AuthUser = { ...user, entitled }

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
            <Link to="/app/account" className={`app-pass-status${entitled ? ' is-active' : ''}`}>
              {entitled ? 'Sky Pass active' : 'Free'}
            </Link>
          </div>
        </div>
      }
    >
      <Routes>
        <Route path="/app/events" element={<EventsPage entitled={entitled} />} />
        <Route path="/app/events/archive" element={<EventArchivePage />} />
        <Route path="/app/events/:id" element={<EventDetailPage user={effectiveUser} entitled={entitled} />} />
        <Route path="/app/conditions" element={<ConditionsPage entitled={entitled} />} />
        <Route path="/app/calendar" element={<CalendarPage user={effectiveUser} entitled={entitled} />} />
        <Route path="/app/account" element={<AccountPage user={effectiveUser} entitlementRefreshing={entitlementRefreshing} />} />
        <Route path="*" element={<Navigate to="/app/events" replace />} />
      </Routes>
    </NavShell>
  )
}
