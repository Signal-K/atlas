import { useRef, type TouchEvent } from 'react'
import { NavLink } from 'react-router-dom'
import type { NavItem } from '../../ui/NavShell'
import { useMobileDetailNav } from '../../lib/mobileDetailNav'

const SWIPE_THRESHOLD = 42

function dispatchMobileAction(name: 'atlas:mobile-home' | 'atlas:next-event') {
  window.dispatchEvent(new CustomEvent(name))
}

interface MobileQuickDockProps {
  items: NavItem[]
}

// Normally a plain Events/Journal/Settings tab bar. While a full-screen
// event detail is open (see lib/mobileDetailNav), it swaps to a back/swipe
// control instead, since the tabs don't apply inside that overlay.
export function MobileQuickDock({ items }: MobileQuickDockProps) {
  const { active: detailActive } = useMobileDetailNav()
  const touchStartX = useRef<number | null>(null)

  function goBack() {
    dispatchMobileAction('atlas:mobile-home')
  }

  function openNextEvent() {
    dispatchMobileAction('atlas:next-event')
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    touchStartX.current = event.touches[0]?.clientX ?? null
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (touchStartX.current == null) return
    const delta = (event.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current
    touchStartX.current = null
    if (delta >= SWIPE_THRESHOLD) goBack()
    if (delta <= -SWIPE_THRESHOLD) openNextEvent()
  }

  if (detailActive) {
    return (
      <nav className="mobile-quick-dock" aria-label="Event navigation">
        <div
          className="mobile-dock-swipe-panel"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <button type="button" className="mobile-dock-home" onClick={goBack}>
            <span className="mobile-dock-home-mark" aria-hidden="true">←</span>
            <span>Back</span>
          </button>
          <button type="button" className="mobile-dock-next" onClick={openNextEvent}>
            <span className="mobile-dock-next-copy">
              <strong>Next event</strong>
              <span>Swipe left to explore</span>
            </span>
            <span className="mobile-dock-next-arrow" aria-hidden="true">→</span>
          </button>
        </div>
      </nav>
    )
  }

  return (
    <nav className="mobile-quick-dock mobile-tab-bar" aria-label="Primary">
      {items.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) => `mobile-tab-item${isActive ? ' is-active' : ''}`}
        >
          <span className="mobile-tab-icon" aria-hidden="true">
            {item.icon}
          </span>
          <span className="mobile-tab-label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
