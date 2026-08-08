import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { authErrorMessage, requestPasswordReset, signIn, signUp } from '../lib/auth'
import { trackEvent } from '../lib/analytics'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'

export interface AuthFormProps {
  defaultMode?: 'sign-in' | 'sign-up'
  source: string
  intro?: ReactNode
  onSignedUp?: () => void
  onSignedIn?: () => void
  onModeChange?: (mode: 'sign-in' | 'sign-up') => void
}

export function AuthForm({ defaultMode = 'sign-in', source, intro, onSignedUp, onSignedIn, onModeChange }: AuthFormProps) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>(defaultMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Only fire "started" once per mount, on the visitor's first interaction
  // with the form -- not on every keystroke.
  const startedRef = useRef(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  function trackFormStarted() {
    if (startedRef.current) return
    startedRef.current = true
    trackEvent('Account form started', { source, mode })
  }

  async function handleForgotPassword() {
    setResetError(null)
    if (!email) {
      setResetError('Enter your email above first.')
      return
    }
    try {
      await requestPasswordReset(email)
      trackEvent('Password reset requested', { source })
      setResetSent(true)
    } catch (err) {
      setResetError(authErrorMessage(err, 'Could not send reset email.'))
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    trackEvent('Account form submitted', { source, mode })
    try {
      if (mode === 'sign-in') {
        await signIn(email, password)
        trackEvent('Sign in completed', { source })
        onSignedIn?.()
      } else {
        await signUp(email, password)
        trackEvent('Sign up completed', { source })
        onSignedUp?.()
      }
    } catch (err) {
      const fallback = mode === 'sign-in' ? 'Sign-in failed — check your email and password.' : 'Sign-up failed.'
      setError(authErrorMessage(err, fallback))
      trackEvent(mode === 'sign-in' ? 'Sign in failed' : 'Sign up failed', { source })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-form-wrap">
      {intro}
      <form className="account-form" onSubmit={handleSubmit} onFocus={trackFormStarted}>
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <Input
          label="Password"
          type="password"
          placeholder={mode === 'sign-up' ? 'At least 8 characters' : 'Your password'}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={8}
          required
        />
        {error && <p className="account-form-error">{error}</p>}
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
        </Button>
        <div className="account-form-actions">
          <button
            type="button"
            className="account-form-switch"
            onClick={() => {
              const nextMode = mode === 'sign-in' ? 'sign-up' : 'sign-in'
              setMode(nextMode)
              onModeChange?.(nextMode)
            }}
          >
            {mode === 'sign-in' ? 'Need an account?' : 'Have an account?'}
          </button>
          {mode === 'sign-in' && (
            <button type="button" className="account-form-switch" onClick={handleForgotPassword}>
              Forgot password?
            </button>
          )}
        </div>
        {resetSent && <p className="settings-help settings-status--positive">Password reset link sent to {email}.</p>}
        {resetError && <p className="account-form-error">{resetError}</p>}
      </form>
    </div>
  )
}
