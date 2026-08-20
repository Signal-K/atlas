import { useRef, type TouchEvent } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'

const SWIPE_THRESHOLD = 42

function dispatchMobileAction(name: 'atlas:mobile-home' | 'atlas:next-event') {
  window.dispatchEvent(new CustomEvent(name))
}

export function MobileQuickDock() {
  const navigate = useNavigate()
  const touchStartX = useRef<number | null>(null)

  function goHome() {
    dispatchMobileAction('atlas:mobile-home')
    navigate('/app/events')
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
    if (delta >= SWIPE_THRESHOLD) goHome()
    if (delta <= -SWIPE_THRESHOLD) openNextEvent()
  }

  return (
    <nav className="mobile-quick-dock" aria-label="Quick navigation">
      <div
        className="mobile-dock-swipe-panel"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <button type="button" className="mobile-dock-home" onClick={goHome}>
          <span className="mobile-dock-home-mark" aria-hidden="true">⌂</span>
          <span>Home</span>
        </button>
        <button type="button" className="mobile-dock-next" onClick={openNextEvent}>
          <span className="mobile-dock-next-copy">
            <strong>Next event</strong>
            <span>Swipe left to explore</span>
          </span>
          <span className="mobile-dock-next-arrow" aria-hidden="true">→</span>
        </button>
      </div>
      <div className="mobile-dock-links" aria-label="More areas">
        <NavLink to="/app/journal">Journal</NavLink>
        <NavLink to="/app/settings">Settings</NavLink>
      </div>
    </nav>
  )
}
