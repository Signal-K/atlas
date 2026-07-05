import { useEffect, useState } from 'react'
import { applyTheme, getStoredTheme, getSystemTheme, storeTheme, type Theme } from '../lib/theme'
import type { LocationStatus } from '../lib/geo'
import { AccountSettings } from './AccountSettings'

interface SettingsViewProps {
  locationStatus: LocationStatus
  requestLocation: () => void
  needsMotionPermission: boolean
  requestMotionPermission: () => void
  accountDefaultMode?: 'sign-in' | 'sign-up'
}

const LOCATION_LABEL: Record<LocationStatus, string> = {
  idle: 'Not yet requested',
  pending: 'Requesting…',
  granted: 'Enabled',
  denied: 'Blocked by browser',
  unsupported: 'Not supported on this device',
}

export function SettingsView({
  locationStatus,
  requestLocation,
  needsMotionPermission,
  requestMotionPermission,
  accountDefaultMode,
}: SettingsViewProps) {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme() ?? getSystemTheme())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  function choose(next: Theme) {
    setTheme(next)
    storeTheme(next)
  }

  return (
    <section className="widget-section">
      <h2>Settings</h2>

      <AccountSettings defaultMode={accountDefaultMode} />

      <div className="settings-row">
        <span className="settings-label">Appearance</span>
        <div className="settings-choice">
          <button type="button" className={theme === 'light' ? 'is-active' : ''} onClick={() => choose('light')}>
            Light
          </button>
          <button type="button" className={theme === 'dark' ? 'is-active' : ''} onClick={() => choose('dark')}>
            Dark
          </button>
        </div>
      </div>

      <div className="settings-row">
        <span className="settings-label">Location-based sky</span>
        <div className="settings-choice">
          <span className="settings-status">{LOCATION_LABEL[locationStatus]}</span>
          {(locationStatus === 'idle' || locationStatus === 'denied' || locationStatus === 'pending') && (
            <button type="button" onClick={requestLocation}>
              {locationStatus === 'denied' ? 'Retry' : 'Enable'}
            </button>
          )}
        </div>
      </div>

      <div className="settings-row">
        <span className="settings-label">Motion parallax</span>
        <div className="settings-choice">
          <span className="settings-status">{needsMotionPermission ? 'Not yet enabled' : 'Enabled / not required on this device'}</span>
          {needsMotionPermission && (
            <button type="button" onClick={requestMotionPermission}>
              Enable
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
