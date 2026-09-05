import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation } from 'react-router-dom'
import type { NavItem } from '../../ui/NavShell'

// Mobile primary nav, replacing the persistent bottom tab bar with a
// hamburger trigger + slide-in drawer (deliberate product decision,
// diverging from the Atlas Mobile Claude Design canvas's persistent 5-item
// tab bar -- see AT-0xx / the mobile-bottom-panel-shift session).
//
// In the installed/Home Screen PWA, WKWebView can briefly reserve space at
// the bottom of the screen the instant focus lands on *any* focusable
// element, not just a text input, then retract it once it determines no
// keyboard is needed -- see AppTabBar's blurOnActivate for the fuller
// writeup. The same applies here, so every activatable element in this
// drawer blurs itself immediately after firing.
function blurOnActivate(event: { currentTarget: HTMLElement }) {
  event.currentTarget.blur()
}

export function MobileNavTrigger({ open, onOpen }: { open: boolean; onOpen: () => void }) {
  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    onOpen()
    blurOnActivate(event)
  }
  return (
    <button
      type="button"
      className="az-icon-btn az-nav-trigger"
      aria-label="Open menu"
      aria-expanded={open}
      aria-controls="mobile-navigation-panel"
      onClick={handleClick}
    >
      <span aria-hidden="true" className="az-nav-trigger-lines">
        <i />
        <i />
        <i />
      </span>
    </button>
  )
}

export function MobileNavDrawer({ items, open, onClose }: { items: NavItem[]; open: boolean; onClose: () => void }) {
  const location = useLocation()

  useEffect(() => {
    if (open) onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  function handleClose(event: React.MouseEvent<HTMLButtonElement>) {
    onClose()
    blurOnActivate(event)
  }

  function handleLinkClick(event: React.MouseEvent<HTMLAnchorElement>) {
    onClose()
    blurOnActivate(event)
  }

  return createPortal(
    <>
      <div className="az-nav-drawer-backdrop" onClick={onClose} />
      <aside id="mobile-navigation-panel" className="az-nav-drawer" role="dialog" aria-modal="true" aria-label="Primary navigation">
        <div className="az-nav-drawer-head">
          <strong>Atlas</strong>
          <button type="button" className="az-icon-btn" aria-label="Close menu" onClick={handleClose}>
            ×
          </button>
        </div>
        <nav className="az-nav-drawer-links" aria-label="Primary">
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `az-nav-drawer-link${isActive ? ' is-active' : ''}`}
              onClick={handleLinkClick}
            >
              <span aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>,
    document.body,
  )
}
