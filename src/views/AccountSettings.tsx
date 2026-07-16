import { useRef, useState } from 'react'
import { authErrorMessage, signIn, signOut, signUp, useAuth } from '../lib/auth'
import { trackEvent } from '../lib/analytics'

export function AccountSettings({
  defaultMode = 'sign-in',
  source = 'settings',
}: {
  defaultMode?: 'sign-in' | 'sign-up'
  source?: string
}) {
  const { user } = useAuth()
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>(defaultMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Only fire "started" once per mount, on the visitor's first interaction
  // with the form -- not on every keystroke.
  const startedRef = useRef(false)

  function trackFormStarted() {
    if (startedRef.current) return
    startedRef.current = true
    trackEvent('Account form started', { source, mode })
  }

  if (user) {
    return (
      <div className="settings-row">
        <span className="settings-label">Account</span>
        <div className="settings-choice">
          <span className="settings-status">{user.email}</span>
          <button type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>
    )
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    trackEvent('Account form submitted', { source, mode })
    try {
      if (mode === 'sign-in') await signIn(email, password)
      else await signUp(email, password)
      trackEvent(mode === 'sign-in' ? 'Sign in completed' : 'Sign up completed', { source })
    } catch (error) {
      const fallback = mode === 'sign-in' ? 'Sign-in failed — check your email and password.' : 'Sign-up failed.'
      setError(authErrorMessage(error, fallback))
      trackEvent(mode === 'sign-in' ? 'Sign in failed' : 'Sign up failed', { source })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="settings-row settings-row--account">
      <span className="settings-label">Account</span>
      <form className="account-form" onSubmit={handleSubmit} onFocus={trackFormStarted}>
        <input type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={8}
          required
        />
        <div className="account-form-actions">
          <button type="submit" disabled={busy}>
            {mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </button>
          <button type="button" className="account-form-switch" onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}>
            {mode === 'sign-in' ? 'Need an account?' : 'Have an account?'}
          </button>
        </div>
        {error && <p className="account-form-error">{error}</p>}
      </form>
    </div>
  )
}
