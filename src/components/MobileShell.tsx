import { useEffect, useState } from 'react'
import { BottomNav, type MobileTab } from './BottomNav'
import { HubView } from '../views/mobile/HubView'
import { EventsView } from '../views/mobile/EventsView'
import { CalendarView } from '../views/CalendarView'
import { WatchView } from '../views/mobile/WatchView'
import { ScrapbookView } from '../views/ScrapbookView'
import { SettingsView } from '../views/SettingsView'
import { applyTheme, getStoredTheme, getSystemTheme, storeTheme } from '../lib/theme'
import type { CurrentLocation } from '../lib/currentLocation'
import type { LocationStatus } from '../lib/geo'
import type { City } from '../lib/cities'
import type { ObservationDraft } from '../lib/observationDraft'

const TAB_LABEL: Record<MobileTab, string> = {
  hub: 'HUB',
  events: 'SKY EVENTS',
  calendar: 'CALENDAR',
  watch: 'WATCHLIST',
  journal: 'JOURNAL',
}

interface MobileShellProps {
  currentLocation: CurrentLocation
  locationStatus: LocationStatus
  requestLocation: () => void
  manualCity: City | null
  setManualLocation: (city: City | null) => void
  needsMotionPermission: boolean
  requestMotionPermission: () => void
}

export function MobileShell({
  currentLocation,
  locationStatus,
  requestLocation,
  manualCity,
  setManualLocation,
  needsMotionPermission,
  requestMotionPermission,
}: MobileShellProps) {
  const [tab, setTab] = useState<MobileTab>('hub')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [observationDraft, setObservationDraft] = useState<ObservationDraft | null>(null)
  const [isDark, setIsDark] = useState(() => (getStoredTheme() ?? getSystemTheme()) === 'dark')

  useEffect(() => {
    applyTheme(isDark ? 'dark' : 'light')
    storeTheme(isDark ? 'dark' : 'light')
  }, [isDark])

  function toggleTheme() {
    setIsDark((current) => !current)
  }

  if (settingsOpen) {
    return (
      <div className="mobile-shell">
        <header className="mobile-header">
          <button type="button" className="mobile-back" onClick={() => setSettingsOpen(false)} aria-label="Back">
            &larr;
          </button>
          <span className="mobile-header-tab-label">SETTINGS</span>
          <span className="mobile-header-spacer" />
        </header>
        <div className="mobile-content">
          <SettingsView
            locationStatus={locationStatus}
            requestLocation={requestLocation}
            currentLocation={currentLocation}
            manualCity={manualCity}
            setManualLocation={setManualLocation}
            needsMotionPermission={needsMotionPermission}
            requestMotionPermission={requestMotionPermission}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="mobile-shell">
      <header className="mobile-header">
        <div className="mobile-header-top">
          <span className="mobile-wordmark">ATLAS</span>
          <div className="mobile-header-actions">
            <button type="button" className="mobile-avatar" onClick={() => setSettingsOpen(true)} aria-label="Settings">
              <svg viewBox="0 0 20 20" fill="currentColor" stroke="none">
                <circle cx="10" cy="7" r="3.2" />
                <path d="M3.5 17c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
              </svg>
            </button>
            <button type="button" className="mobile-theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                {isDark ? (
                  <>
                    <circle cx="10" cy="10" r="3.5" />
                    <path d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.36 4.64l-1.41 1.41M6.05 13.95l-1.41 1.41M15.36 15.36l-1.41-1.41M6.05 6.05 4.64 4.64" />
                  </>
                ) : (
                  <path d="M15.5 11.2A5.5 5.5 0 0 1 9.8 5.5c0-.7.1-1.4.4-2A6.5 6.5 0 1 0 17.5 10.8c-.7.3-1.4.4-2 .4Z" />
                )}
              </svg>
            </button>
          </div>
        </div>
        <div className="mobile-header-meta">
          <span className="mobile-header-tab-label">{TAB_LABEL[tab]}</span>
          <span className="mobile-header-sync">SYNC {new Date().toISOString().slice(0, 10)}</span>
        </div>
      </header>

      <div className="mobile-content">
        {tab === 'hub' && <HubView city={currentLocation} onOpenTab={setTab} />}
        {tab === 'events' && <EventsView />}
        {tab === 'calendar' && <CalendarView />}
        {tab === 'watch' && <WatchView city={currentLocation} />}
        {tab === 'journal' && (
          <ScrapbookView draft={observationDraft} onDraftConsumed={() => setObservationDraft(null)} />
        )}
      </div>

      <BottomNav active={tab} onSelect={setTab} />
    </div>
  )
}
