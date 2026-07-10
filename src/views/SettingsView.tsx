import { useEffect, useState } from 'react'
import { applyTheme, getStoredTheme, getSystemTheme, storeTheme, type Theme } from '../lib/theme'
import type { LocationStatus } from '../lib/geo'
import { getOptInName, optIn, optOut } from '../lib/leaderboard'
import { useAuth } from '../lib/auth'
import { recordWeeklyActivity } from '../lib/streaks'
import { AccountSettings } from './AccountSettings'
import { WidgetSettings } from '../components/WidgetSettings'
import { PushSettings } from '../components/PushSettings'

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

function LeaderboardSettings() {
  const { user } = useAuth()
  const [displayName, setDisplayName] = useState(() => getOptInName() ?? '')
  const [savedName, setSavedName] = useState(() => getOptInName() ?? '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function handleOptIn(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = displayName.trim()
    if (!trimmed || !user) return
    setBusy(true)
    setMessage('')
    try {
      const streak = await recordWeeklyActivity()
      await optIn(trimmed, streak)
      setSavedName(trimmed)
      setDisplayName(trimmed)
      setMessage('Leaderboard entry published.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update leaderboard.')
    } finally {
      setBusy(false)
    }
  }

  async function handleOptOut() {
    setBusy(true)
    setMessage('')
    try {
      await optOut()
      setSavedName('')
      setMessage('Leaderboard entry removed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="settings-row settings-row--leaderboard">
      <div>
        <span className="settings-label">Streak leaderboard</span>
        <p className="settings-help">Publish your weekly streak under a display name. Your account email stays private.</p>
      </div>
      <form className="leaderboard-settings-form" onSubmit={handleOptIn}>
        <input
          type="text"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Display name"
          maxLength={40}
          disabled={!user || busy}
        />
        <div className="leaderboard-settings-actions">
          <button type="submit" disabled={!user || busy || !displayName.trim()}>
            {savedName ? 'Update' : 'Join'}
          </button>
          {savedName && (
            <button type="button" onClick={handleOptOut} disabled={busy}>
              Leave
            </button>
          )}
        </div>
        <p className="settings-help">{user ? message || (savedName ? `Listed as ${savedName}.` : 'Not listed yet.') : 'Sign in above to join.'}</p>
      </form>
    </div>
  )
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

      <PushSettings />

      <LeaderboardSettings />

      <h3 className="calendar-selected-heading">Dashboard widgets</h3>
      <WidgetSettings />
    </section>
  )
}
