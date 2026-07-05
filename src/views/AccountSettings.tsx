import { useState } from 'react'
import { signIn, signOut, signUp, useAuth } from '../lib/auth'

export function AccountSettings() {
  const { user } = useAuth()
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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
    try {
      if (mode === 'sign-in') await signIn(email, password)
      else await signUp(email, password)
    } catch {
      setError(mode === 'sign-in' ? 'Sign-in failed — check your email and password.' : 'Sign-up failed — password needs at least 8 characters.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="settings-row settings-row--account">
      <span className="settings-label">Account</span>
      <form className="account-form" onSubmit={handleSubmit}>
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
