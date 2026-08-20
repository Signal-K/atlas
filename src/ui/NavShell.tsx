import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

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
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  return (
    <div className="nav-shell">
      <button
        type="button"
        className="mobile-menu-trigger"
        aria-expanded={mobileMenuOpen}
        aria-controls="primary-navigation"
        onClick={() => setMobileMenuOpen((open) => !open)}
      >
        <span className="mobile-menu-trigger-icon" aria-hidden="true"><span /><span /><span /></span>
        <span>{mobileMenuOpen ? 'Close' : 'Menu'}</span>
      </button>
      {mobileMenuOpen && <button type="button" className="mobile-menu-backdrop" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)} />}
      <nav id="primary-navigation" className={`nav-shell-nav${mobileMenuOpen ? ' nav-shell-nav-open' : ''}`} aria-label="Primary">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `nav-shell-item${isActive ? ' nav-shell-item-active' : ''}`}
            onClick={() => setMobileMenuOpen(false)}
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
