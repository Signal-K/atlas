import { AppTabBar } from '../components/AppTabBar'
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
}

/**
 * One responsive shell: a side nav on wide viewports, and a top-triggered
 * navigation drawer on narrow ones. Mobile deliberately does not use a
 * persistent bottom navigation bar.
 */
export function NavShell({ items, children, topBar }: NavShellProps) {
  return (
    <div className="nav-shell">
      <nav id="primary-navigation" className="nav-shell-nav" aria-label="Primary">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `nav-shell-item${isActive ? ' nav-shell-item-active' : ''}`}
          >
            <span className="nav-shell-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="nav-shell-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="nav-shell-body">
        {topBar && <div className="nav-shell-topbar">{topBar}</div>}
        <main className="nav-shell-main">{children}</main>
      </div>
      <AppTabBar items={items} />
    </div>
  )
}
