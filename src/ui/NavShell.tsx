import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

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
 * One responsive shell: a side nav on wide viewports, a bottom tab bar on
 * narrow ones. Same markup, same CSS — this is what replaces the separate
 * Sidebar/MobileShell components that used to carry two different themes.
 */
export function NavShell({ items, children, topBar }: NavShellProps) {
  return (
    <div className="nav-shell">
      <nav className="nav-shell-nav" aria-label="Primary">
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
    </div>
  )
}
