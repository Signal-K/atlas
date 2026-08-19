import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthForm } from './AuthForm'

interface AuthGateProps {
  defaultMode: 'sign-in' | 'sign-up'
  onSignedIn: () => void
  onSignedUp: () => void
}

// Blocking, full-screen gate shown right after "Get started" -- nothing
// past this (onboarding, the app shell) renders until useAuth()'s `user`
// is set. Reuses the onboarding overlay's own styling for visual
// continuity with the step that follows it.
//
// This used to have no way out at all: no close button, no guest mode, and
// in a standalone/installed PWA there's no browser chrome to fall back on
// either -- someone who didn't want to sign in right now was simply stuck.
// "Back to Atlas" at least returns to the landing page rather than trapping
// them here.
export function AuthGate({ defaultMode, onSignedIn, onSignedUp }: AuthGateProps) {
  const [mode, setMode] = useState(defaultMode)
  const navigate = useNavigate()

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-modal auth-gate-modal">
        <h2>{mode === 'sign-up' ? 'Create your free account' : 'Sign in to continue'}</h2>
        <p>Save your sky-watching plans and sync them across devices — takes a few seconds.</p>
        <AuthForm
          defaultMode={defaultMode}
          source="auth_gate"
          onModeChange={setMode}
          onSignedIn={onSignedIn}
          onSignedUp={onSignedUp}
        />
        <button type="button" className="onboarding-skip" onClick={() => navigate('/')}>
          Back to Atlas
        </button>
      </div>
    </div>
  )
}
