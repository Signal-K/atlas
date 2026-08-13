import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { authErrorMessage, requestPasswordReset, signIn, signUp } from '../lib/auth'
import { trackEvent } from '../lib/analytics'
import { mergeLocalDataIntoAccount } from '../lib/accountMerge'
import { pb } from '../lib/pocketbase'
import { redeemStoredDemoAccessCode } from '../lib/demoAccess'

export interface AuthFormProps {
  defaultMode?: 'sign-in' | 'sign-up'
  source: string
  intro?: ReactNode
  // Only relevant on sign-up: how many locally-saved records (from before
  // this account existed) got merged in. Settings uses this to show
  // SignupWelcomeBeat; other callers can ignore it.
  onSignedUp?: (mergedCount: number) => void
  onSignedIn?: () => void
  onModeChange?: (mode: 'sign-in' | 'sign-up') => void
}

function Spinner() {
  return (
    <svg className="account-form-spinner" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

function EyeIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
      <circle cx="12" cy="12" r="3" />
      {crossed && <path d="M3.5 3.5 20.5 20.5" />}
    </svg>
  )
}

// Shared sign-in/sign-up form, used both embedded in Settings (signed-out
// state) and as the full-screen AuthGate shown before onboarding. The mode
// switcher used to be a single small text link below the submit button --
// easy to fire off "Create account" without noticing, which for a first-
// time visitor typing an email their family of apps already recognizes
// meant a brand new account got created where a login was intended (no
// server-side "this email already exists in a different context" signal
// is available client-side, so the only real fix is making the mode itself
// impossible to miss).
export function AuthForm({ defaultMode = 'sign-in', source, intro, onSignedUp, onSignedIn, onModeChange }: AuthFormProps) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>(defaultMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Only fire "started" once per mount, on the visitor's first interaction
  // with the form -- not on every keystroke.
  const startedRef = useRef(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const emailId = useId()
  const passwordId = useId()

  function trackFormStarted() {
    if (startedRef.current) return
    startedRef.current = true
    trackEvent('Account form started', { source, mode })
  }

  function switchMode(nextMode: 'sign-in' | 'sign-up') {
    if (nextMode === mode) return
    setMode(nextMode)
    setError(null)
    setResetSent(false)
    setResetError(null)
    onModeChange?.(nextMode)
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
        const demoAccess = await redeemStoredDemoAccessCode()
        trackEvent('Sign in completed', { source, demoAccess })
        onSignedIn?.()
      } else {
        const { created } = await signUp(email, password)
        const demoAccess = await redeemStoredDemoAccessCode()
        const userId = pb.authStore.record?.id as string | undefined
        const result = userId
          ? await mergeLocalDataIntoAccount(userId)
          : { favourites: 0, watchlist: 0, observations: 0, cameraPresets: 0, targetTaps: 0, equipmentChoice: 0, total: 0 }
        trackEvent(created ? 'Sign up completed' : 'Sign up matched existing account', {
          source,
          mergedCount: result.total,
          demoAccess,
        })
        trackEvent('Merge result', {
          source,
          favourites: result.favourites,
          watchlist: result.watchlist,
          observations: result.observations,
          cameraPresets: result.cameraPresets,
          targetTaps: result.targetTaps,
          equipmentChoice: result.equipmentChoice,
          total: result.total,
          demoAccess,
        })
        onSignedUp?.(result.total)
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
    <div className="settings-row settings-row--account">
      {intro}
      <div className="account-form-shell">
        <div className="account-mode-tabs" role="tablist" aria-label="Sign in or create an account">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'sign-in'}
            className={mode === 'sign-in' ? 'is-active' : ''}
            onClick={() => switchMode('sign-in')}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'sign-up'}
            className={mode === 'sign-up' ? 'is-active' : ''}
            onClick={() => switchMode('sign-up')}
          >
            Create account
          </button>
        </div>

        <form className="account-form" onSubmit={handleSubmit} onFocus={trackFormStarted}>
          <div className="account-form-field">
            <label htmlFor={emailId}>Email</label>
            <input
              id={emailId}
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="account-form-field">
            <label htmlFor={passwordId}>Password</label>
            <div className="account-form-password">
              <input
                id={passwordId}
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                placeholder={mode === 'sign-in' ? 'Your password' : 'At least 8 characters'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />
              <button
                type="button"
                className="account-form-password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                tabIndex={-1}
              >
                <EyeIcon crossed={showPassword} />
              </button>
            </div>
          </div>

          <div className="account-form-actions">
            <button type="submit" className="account-form-submit" disabled={busy}>
              {busy && <Spinner />}
              {mode === 'sign-in' ? 'Sign in' : 'Create account'}
            </button>
            {mode === 'sign-in' && (
              <button type="button" className="account-form-switch" onClick={handleForgotPassword}>
                Forgot password?
              </button>
            )}
          </div>
          {error && <p className="account-form-error">{error}</p>}
          {resetSent && <p className="settings-help settings-status--positive">Password reset link sent to {email}.</p>}
          {resetError && <p className="account-form-error">{resetError}</p>}
        </form>
      </div>
    </div>
  )
}
