import { useRef, useState, type FormEvent, type ReactNode } from 'react'
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

// Shared sign-in/sign-up form, used both embedded in Settings (signed-out
// state) and as the full-screen AuthGate shown before onboarding.
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
        const demoAccess = await redeemStoredDemoAccessCode()
        trackEvent('Sign in completed', { source, demoAccess })
        onSignedIn?.()
      } else {
        await signUp(email, password)
        const demoAccess = await redeemStoredDemoAccessCode()
        const userId = pb.authStore.record?.id as string | undefined
        const result = userId
          ? await mergeLocalDataIntoAccount(userId)
          : { favourites: 0, watchlist: 0, observations: 0, cameraPresets: 0, targetTaps: 0, equipmentChoice: 0, total: 0 }
        trackEvent('Sign up completed', { source, mergedCount: result.total, demoAccess })
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
        {error && <p className="account-form-error">{error}</p>}
        {resetSent && <p className="settings-help settings-status--positive">Password reset link sent to {email}.</p>}
        {resetError && <p className="account-form-error">{resetError}</p>}
      </form>
    </div>
  )
}
