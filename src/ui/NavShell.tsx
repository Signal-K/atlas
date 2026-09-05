import { Starfield } from '../components/mobile/Starfield'
import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'

export interface NavItem {
  path: string
  label: string
  icon: ReactNode
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
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `nav-shell-item az-rail-item${isActive ? ' nav-shell-item-active' : ''}`}
          >
            <span className="nav-shell-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="nav-shell-label">{item.label}</span>
          </NavLink>
        ))}
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
