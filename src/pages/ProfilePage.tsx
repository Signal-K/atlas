import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sheet } from '../components/mobile/Sheet'
import { MobileIcon } from '../components/mobile/MobileIcon'
import { useToast } from '../components/mobile/Toast'
import { AccountSettings } from '../views/AccountSettings'
import { DeviceSettings } from '../components/DeviceSettings'
import { PushSettings } from '../components/PushSettings'
import { LeaderboardSettings } from '../components/LeaderboardSettings'
import { PaywallGate } from '../components/PaywallGate'
import { useAuth } from '../lib/auth'
import { useThemeState } from '../lib/theme'
import { getPushSubscription, isIOSSafariNotStandalone, isPushSupported } from '../lib/push'
import { getOptInName } from '../lib/leaderboard'
import { db } from '../lib/db'
import { downloadObservationsCsv } from '../lib/observationExport'
import { VIEWING_INSTRUMENTS } from '../lib/tripPlans'
import type { LocationStatus } from '../lib/geo'
import type { City } from '../lib/cities'
import type { CurrentLocation } from '../lib/currentLocation'

export interface ProfilePageProps {
  locationStatus: LocationStatus
  requestLocation: () => void
  currentLocation: CurrentLocation
  manualCity: City | null
  setManualLocation: (city: City | null) => void
  needsMotionPermission: boolean
  requestMotionPermission: () => void
  accountDefaultMode?: 'sign-in' | 'sign-up'
  onOpenLocation: () => void
}

function initialsFor(email?: string): string {
  if (!email) return '◌'
  const local = email.split('@')[0]
  const parts = local.split(/[.\-_+]/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return local.slice(0, 2).toUpperCase()
}

export function ProfilePage({ currentLocation, accountDefaultMode, onOpenLocation }: ProfilePageProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [theme, toggleTheme] = useThemeState()
  const [showAccount, setShowAccount] = useState(false)
  const [deviceSheetOpen, setDeviceSheetOpen] = useState(false)
  const [notificationsSheetOpen, setNotificationsSheetOpen] = useState(false)
  const [leaderboardSheetOpen, setLeaderboardSheetOpen] = useState(false)
  const [paywallSheetOpen, setPaywallSheetOpen] = useState(false)
  const [pushLabel, setPushLabel] = useState('Checking…')
  const [pendingSyncCount, setPendingSyncCount] = useState<number | null>(null)
  const optInName = getOptInName()

  useEffect(() => {
    if (!isPushSupported()) {
      setPushLabel(isIOSSafariNotStandalone() ? 'Add to Home Screen to enable' : 'Not supported on this browser')
      return
    }
    if (!user) {
      setPushLabel('Sign in required')
      return
    }
    let cancelled = false
    getPushSubscription().then((sub) => {
      if (!cancelled) setPushLabel(sub ? 'Enabled' : 'Not enabled')
    })
    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    let cancelled = false
    db.syncQueue.count().then((count) => {
      if (!cancelled) setPendingSyncCount(count)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (showAccount) {
    return (
      <div className="az-page">
        <button type="button" className="az-back-btn" onClick={() => setShowAccount(false)}>
          <MobileIcon name="back" size={16} /> You
        </button>
        <h1 className="az-h1" style={{ marginTop: '0.5rem', fontSize: '1.5rem' }}>
          Account
        </h1>
        <div style={{ marginTop: '1rem' }}>
          <AccountSettings defaultMode={accountDefaultMode} source="profile" />
        </div>
      </div>
    )
  }

  async function handleExport() {
    const scopeId = user?.id ?? 'local'
    const entries = await db.observations.where('userId').equals(scopeId).toArray()
    if (entries.length === 0) {
      toast('No observations to export yet.')
      return
    }
    downloadObservationsCsv(entries)
    toast(`Exported ${entries.length} observation${entries.length === 1 ? '' : 's'} as CSV.`)
  }

  return (
    <div className="az-page">
      <h1 className="az-h1">You</h1>

      <div className="az-card" style={{ marginTop: '1rem' }}>
        <div className="az-card-body" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span
            aria-hidden="true"
            style={{
              flex: 'none',
              width: '3rem',
              height: '3rem',
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              background: 'linear-gradient(160deg, var(--az-violet), var(--az-teal))',
              color: '#fff',
              font: '600 0.9375rem var(--az-font-display)',
            }}
          >
            {initialsFor(user?.email)}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <strong style={{ display: 'block', fontSize: '0.9375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email ?? 'Not signed in'}
            </strong>
            <span className="az-pill" style={{ '--pill-hue': user?.entitled ? 145 : 240, marginTop: '0.3125rem' } as React.CSSProperties}>
              {user?.entitled ? 'SKY PASS · ACTIVE' : 'FREE ACCOUNT'}
            </span>
          </div>
        </div>
      </div>

      {!user?.entitled && (
        <button
          type="button"
          className="az-card"
          style={{ width: '100%', textAlign: 'left', cursor: 'pointer', marginTop: '0.75rem' }}
          onClick={() => setPaywallSheetOpen(true)}
        >
          <div className="az-card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div style={{ minWidth: 0 }}>
              <span className="az-kicker">Sky Pass</span>
              <strong style={{ display: 'block', fontSize: '0.9375rem', margin: '0.25rem 0 0.125rem' }}>Get Sky Pass · £24 once</strong>
              <p className="az-muted" style={{ margin: 0, fontSize: '0.78125rem' }}>
                Unlock 90-day plans, saved targets, reminders, dark sites, gear fit, community, and archive.
              </p>
            </div>
            <span className="az-row-chevron" style={{ opacity: 0.5 }}>
              <MobileIcon name="chevron" size={16} />
            </span>
          </div>
        </button>
      )}

      <div className="az-section-head">
        <span className="az-kicker">Personal</span>
      </div>
      <div className="az-row-group">
        <button type="button" className="az-row" onClick={onOpenLocation}>
          <span className="az-row-icon">
            <MobileIcon name="pin" />
          </span>
          <span className="az-row-main">
            <span className="az-row-title">Location & sensors</span>
            <span className="az-row-value">{currentLocation.name}</span>
          </span>
          <span className="az-row-chevron">
            <MobileIcon name="chevron" size={14} />
          </span>
        </button>

        <div className="az-row">
          <span className="az-row-icon">
            <MobileIcon name="sun" />
          </span>
          <span className="az-row-main">
            <span className="az-row-title">Appearance</span>
            <span className="az-row-value">{theme === 'dark' ? 'Dark' : 'Light'}</span>
          </span>
          <button type="button" className={`az-toggle${theme === 'dark' ? ' is-on' : ''}`} onClick={toggleTheme} aria-label="Toggle dark mode">
            <span className="az-toggle-knob" />
          </button>
        </div>

        {user && (
          <button type="button" className="az-row" onClick={() => setDeviceSheetOpen(true)}>
            <span className="az-row-icon">
              <MobileIcon name="camera" />
            </span>
            <span className="az-row-main">
              <span className="az-row-title">Device & camera setup</span>
              <span className="az-row-value">{user.deviceModels.length > 0 ? user.deviceModels.join(', ') : 'No device selected'}</span>
            </span>
            <span className="az-row-chevron">
              <MobileIcon name="chevron" size={14} />
            </span>
          </button>
        )}

        {user && (
          <button type="button" className="az-row" onClick={() => setDeviceSheetOpen(true)}>
            <span className="az-row-icon">
              <MobileIcon name="telescope" />
            </span>
            <span className="az-row-main">
              <span className="az-row-title">Instruments & gear</span>
              <span className="az-row-value">{VIEWING_INSTRUMENTS.map((i) => i.label).join(' · ')}</span>
            </span>
            <span className="az-row-chevron">
              <MobileIcon name="chevron" size={14} />
            </span>
          </button>
        )}
      </div>

      <div className="az-section-head">
        <span className="az-kicker">Atlas</span>
      </div>
      <div className="az-row-group">
        <button type="button" className="az-row" onClick={() => setNotificationsSheetOpen(true)}>
          <span className="az-row-icon">
            <MobileIcon name="bell" />
          </span>
          <span className="az-row-main">
            <span className="az-row-title">Notifications</span>
            <span className="az-row-value">{pushLabel}</span>
          </span>
          <span className="az-row-chevron">
            <MobileIcon name="chevron" size={14} />
          </span>
        </button>

        <button type="button" className="az-row" onClick={() => navigate('/app/ask')}>
          <span className="az-row-icon">
            <MobileIcon name="sparkle" />
          </span>
          <span className="az-row-main">
            <span className="az-row-title">Ask Atlas</span>
            <span className="az-row-value">{user?.entitled ? 'Sky Pass perk' : 'Get Sky Pass to unlock'}</span>
          </span>
          <span className="az-row-chevron">
            <MobileIcon name="chevron" size={14} />
          </span>
        </button>

        <button type="button" className="az-row" onClick={() => setLeaderboardSheetOpen(true)}>
          <span className="az-row-icon">
            <MobileIcon name="trophy" />
          </span>
          <span className="az-row-main">
            <span className="az-row-title">Streak leaderboard</span>
            <span className="az-row-value">{optInName ? `Listed as ${optInName}` : 'Not listed'}</span>
          </span>
          <span className="az-row-chevron">
            <MobileIcon name="chevron" size={14} />
          </span>
        </button>

        <button type="button" className="az-row" onClick={() => navigate('/app/journal')}>
          <span className="az-row-icon">
            <MobileIcon name="users" />
          </span>
          <span className="az-row-main">
            <span className="az-row-title">Community & sharing</span>
            <span className="az-row-value">Browse and share sightings in Journal</span>
          </span>
          <span className="az-row-chevron">
            <MobileIcon name="chevron" size={14} />
          </span>
        </button>
      </div>

      <div className="az-section-head">
        <span className="az-kicker">Account</span>
      </div>
      <div className="az-row-group">
        <button type="button" className="az-row" onClick={() => setShowAccount(true)}>
          <span className="az-row-icon">
            <MobileIcon name="person" />
          </span>
          <span className="az-row-main">
            <span className="az-row-title">Account</span>
            <span className="az-row-value">{user ? user.email : 'Sign in or create an account'}</span>
          </span>
          <span className="az-row-chevron">
            <MobileIcon name="chevron" size={14} />
          </span>
        </button>

        <div className="az-row">
          <span className="az-row-icon">
            <MobileIcon name="cloud" />
          </span>
          <span className="az-row-main">
            <span className="az-row-title">Offline & sync</span>
            <span className="az-row-value">
              {pendingSyncCount == null ? 'Checking…' : pendingSyncCount > 0 ? `${pendingSyncCount} change${pendingSyncCount === 1 ? '' : 's'} pending` : 'Synced when online'}
            </span>
          </span>
        </div>

        <button type="button" className="az-row" onClick={handleExport}>
          <span className="az-row-icon">
            <MobileIcon name="gear" />
          </span>
          <span className="az-row-main">
            <span className="az-row-title">Data & export</span>
            <span className="az-row-value">Download your observations as CSV</span>
          </span>
          <span className="az-row-chevron">
            <MobileIcon name="chevron" size={14} />
          </span>
        </button>
      </div>

      <Sheet open={deviceSheetOpen} title="Device & camera setup" onClose={() => setDeviceSheetOpen(false)}>
        <p className="az-muted" style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem' }}>
          Atlas gives setup guidance for {VIEWING_INSTRUMENTS.map((i) => i.label.toLowerCase()).join(', ')} viewing, tailored to the phone(s) you shoot with.
        </p>
        {user && <DeviceSettings deviceModels={user.deviceModels} entitled={user.entitled} />}
      </Sheet>

      <Sheet open={notificationsSheetOpen} title="Notifications" onClose={() => setNotificationsSheetOpen(false)}>
        <PushSettings />
      </Sheet>

      <Sheet open={leaderboardSheetOpen} title="Streak leaderboard" onClose={() => setLeaderboardSheetOpen(false)}>
        <LeaderboardSettings />
      </Sheet>

      <Sheet open={paywallSheetOpen} title="Sky Pass" onClose={() => setPaywallSheetOpen(false)}>
        <PaywallGate
          user={user}
          feature="profile"
          description="A one-time purchase that unlocks the full Atlas planning toolkit for every future trip."
          onSignInClick={() => {
            setPaywallSheetOpen(false)
            setShowAccount(true)
          }}
        >
          <p className="az-muted" style={{ margin: 0, fontSize: '0.8125rem' }}>You&rsquo;re all set — Sky Pass is active on this account.</p>
        </PaywallGate>
      </Sheet>
    </div>
  )
}
