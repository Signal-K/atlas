import { Starfield } from '../components/mobile/Starfield'
import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'

export interface NavItem {
  path: string
  label: string
  icon: ReactNode
  // ASV-47: guests can use Hub without an account. The rest of the rail
  // still needs one, and saying so up front is kinder than letting someone
  // tap through to a full-screen signup form with no warning.
  locked?: boolean
}

interface NavShellProps {
  items: NavItem[]
  children: ReactNode
  topBar?: ReactNode
  dark?: boolean
}

/**
 * One responsive shell: an always-visible side rail on wide viewports. On
 * narrow ones the rail is hidden and primary nav moves into the TopBar's
 * hamburger trigger + MobileNavDrawer instead (rendered by AppShell,
 * alongside this component, since the drawer needs to portal above
 * everything and the trigger lives inside the topBar slot).
 */
export function NavShell({ items, children, topBar, dark = false }: NavShellProps) {
  return (
    <div className="nav-shell">
      <nav id="primary-navigation" className="nav-shell-nav" aria-label="Primary">
        <NavLink className="az-rail-brand" to="/app/hub" aria-label="Atlas home">
          <span className="az-rail-brand-mark" aria-hidden="true">✦</span>
          <span>Atlas</span>
        </NavLink>
        <div className="az-rail-workspace">
          <span className="az-rail-workspace-dot" aria-hidden="true" />
          <span>My sky</span>
          <span className="az-rail-workspace-caret" aria-hidden="true">⌄</span>
        </div>
        <p className="az-rail-label">Workspace</p>
        <div className="az-rail-links">
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `nav-shell-item az-rail-item${isActive ? ' nav-shell-item-active' : ''}${item.locked ? ' nav-shell-item-locked' : ''}`
              }
              title={item.locked ? `${item.label} needs a free account` : undefined}
            >
              <span className="nav-shell-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="nav-shell-label">{item.label}</span>
              {item.locked && <span className="nav-shell-lock" aria-label="needs an account">&#9679;</span>}
            </NavLink>
          ))}
        </div>
        <p className="az-rail-note">Your local sky,<br />in one place.</p>
      </nav>
      <div className="nav-shell-body">
        <div className="az-shell-bg">
          <Starfield dark={dark} />
        </div>
        {topBar && <div className="nav-shell-topbar">{topBar}</div>}
        <main className="nav-shell-main">{children}</main>
      </div>
    </div>
  )
}
