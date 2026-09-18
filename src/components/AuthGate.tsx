import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthForm } from './AuthForm'
import { getDarknessWindow } from '../lib/darknessWindow'
import { moonIlluminationPctAt } from '../lib/moonPhase'
import type { CurrentLocation } from '../lib/currentLocation'

interface AuthGateProps {
  defaultMode: 'sign-in' | 'sign-up'
  onSignedIn: () => void
  onSignedUp: () => void
  currentLocation?: CurrentLocation
  // Where "back" goes. Defaults to the landing page, but a guest who hit
  // this by tapping a locked tab (ASV-47) came from Hub and should land
  // back there instead of being ejected from the product.
  backTo?: string
  backLabel?: string
}

interface TonightSnapshot {
  darkFromLabel: string
  moonPct: number
}

function formatLocalTime(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone })
}

// Blocking, full-screen gate shown right after "Get started" -- nothing
// past this (onboarding, the app shell) renders until useAuth()'s `user`
// is set. Atlas Auth design (ASV-32): a fixed-width form column with the
// sky as the value pitch beside it, rather than the bare unstyled panel
// this used to be.
//
// This used to have no way out at all: no close button, no guest mode, and
// in a standalone/installed PWA there's no browser chrome to fall back on
// either -- someone who didn't want to sign in right now was simply stuck.
// "Back to Atlas" at least returns to the landing page rather than trapping
// them here.
export function AuthGate({
  defaultMode,
  onSignedIn,
  onSignedUp,
  currentLocation,
  backTo = '/',
  backLabel = 'Back to Atlas',
}: AuthGateProps) {
  const [mode, setMode] = useState(defaultMode)
  const [tonight, setTonight] = useState<TonightSnapshot | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!currentLocation) return
    const now = new Date()
    const darkness = getDarknessWindow(currentLocation.lat, currentLocation.lon, now, new Date(now.getTime() + 2 * 86_400_000))
    const darkFromIso = darkness.astronomicalDuskAt ?? darkness.civilDuskAt ?? darkness.sunsetAt
    setTonight({
      darkFromLabel: darkFromIso ? formatLocalTime(darkFromIso, currentLocation.timeZone) : '—',
      moonPct: Math.round(moonIlluminationPctAt(now)),
    })
  }, [currentLocation])

  return (
    <div className="onboarding-overlay auth-gate-overlay">
      <div className="onboarding-modal auth-gate-modal">
        <div className="auth-gate-form-panel">
          <div className="auth-gate-wordmark">Atlas</div>

          <div className="auth-gate-form-body">
            <h1>{mode === 'sign-up' ? 'Create your free account' : 'Welcome back'}</h1>
            <p className="auth-gate-subhead">
              {mode === 'sign-up'
                ? 'Anything you have already saved on this device comes with you.'
                : 'Sign in to pick up your plans, journal and watchlist.'}
            </p>

            <AuthForm
              defaultMode={defaultMode}
              source="auth_gate"
              onModeChange={setMode}
              onSignedIn={onSignedIn}
              onSignedUp={onSignedUp}
            />
          </div>

          <button type="button" className="onboarding-skip auth-gate-back" onClick={() => navigate(backTo)}>
            <span aria-hidden="true">←</span>{backLabel}
          </button>
        </div>

        <div className="auth-gate-sky" aria-hidden="true">
          <div className="auth-gate-starfield auth-gate-starfield--a" />
          <div className="auth-gate-starfield auth-gate-starfield--b" />
          <div className="auth-gate-sky-copy">
            <p>Ten thousand clear nights, filed by date.</p>
            <div className="auth-gate-sky-stats">
              <span>{currentLocation ? `${currentLocation.name} tonight` : 'Tonight'}</span>
              <span className="auth-gate-sky-divider" />
              <span>Dark from {tonight?.darkFromLabel ?? '—'}</span>
              <span className="auth-gate-sky-divider" />
              <span>Moon {tonight ? `${tonight.moonPct}%` : '—'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
