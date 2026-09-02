import { useEffect, useState } from 'react'
import { MobileIcon } from '../components/mobile/MobileIcon'
import type { Theme } from '../lib/theme'

// Persistent header chrome shown above Hub/Events/Planner/Journal/Profile:
// live clock, location chip (opens the Location sheet), search icon (opens
// the Search overlay), theme toggle. Hidden while the Search overlay is
// open, matching the mockup's showChrome.
export function TopBar({
  locationName,
  onOpenLocation,
  onOpenSearch,
  theme,
  onToggleTheme,
}: {
  locationName: string
  onOpenLocation: () => void
  onOpenSearch: () => void
  theme: Theme
  onToggleTheme: () => void
}) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  const clock = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })

  return (
    <>
      <div className="az-clock-row">
        <span>{clock}</span>
      </div>
      <div className="az-topbar">
        <button type="button" onClick={onOpenLocation} className="az-location-chip">
          <span className="az-dot" aria-hidden="true" />
          {locationName}
          <span className="az-caret" aria-hidden="true">
            ▾
          </span>
        </button>
        <div className="az-topbar-actions">
          <button type="button" onClick={onOpenSearch} aria-label="Search" className="az-icon-btn">
            <MobileIcon name="search" />
          </button>
          <button type="button" onClick={onToggleTheme} aria-label="Toggle theme" className="az-icon-btn">
            <MobileIcon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
        </div>
      </div>
    </>
  )
}
