import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import type { NavItem } from '../../ui/NavShell'
import { useMobileDetailNav } from '../../lib/mobileDetailNav'

interface MobileQuickDockProps {
  items: NavItem[]
}

export function MobileQuickDock({ items }: MobileQuickDockProps) {
  const [open, setOpen] = useState(false)
  const { active: detailActive } = useMobileDetailNav()
  const location = useLocation()

  useEffect(() => setOpen(false), [location.pathname])

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  return (
    <>
      {!detailActive && <button
        type="button"
        className="mobile-menu-trigger"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="mobile-navigation-panel"
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden="true" className="mobile-menu-trigger-lines"><i /><i /><i /></span>
      </button>}
      {open && !detailActive && (
        <div className="mobile-menu-layer" role="presentation">
          <button type="button" className="mobile-menu-backdrop" aria-label="Close menu" onClick={() => setOpen(false)} />
          <aside id="mobile-navigation-panel" className="mobile-menu-panel" aria-label="Mobile menu">
            <div className="mobile-menu-panel-head">
              <span>Atlas</span>
              <button type="button" className="mobile-menu-close" aria-label="Close menu" onClick={() => setOpen(false)}>×</button>
            </div>
            <nav className="mobile-menu-links" aria-label="Primary">
              {items.map((item) => (
                <NavLink key={item.path} to={item.path} onClick={() => setOpen(false)}>
                  <span aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
            <button
              type="button"
              className="mobile-menu-request"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('atlas:open-feature-request'))
                setOpen(false)
              }}
            >
              <span aria-hidden="true">+</span>
              Request a feature
            </button>
          </aside>
        </div>
      )}
    </>
  )
}
