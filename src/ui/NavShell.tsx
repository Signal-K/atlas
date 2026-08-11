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
  railTopAction?: ReactNode
}

/**
 * One responsive shell: a side nav on wide viewports, a bottom tab bar on
 * narrow ones. Same markup, same CSS.
 */
export function NavShell({ items, children, topBar, railTopAction }: NavShellProps) {
  return (
    <div className="nav-shell">
      <nav className="nav-shell-nav" aria-label="Primary">
        {railTopAction && (
          <>
            <div className="nav-shell-rail-top">{railTopAction}</div>
            <div className="nav-shell-divider" aria-hidden="true" />
          </>
        )}
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
