import { useEffect, useRef, useState } from 'react'
import { authErrorMessage, refreshEntitlement, signIn, signOut, signUp, useAuth } from '../lib/auth'
import { trackEvent } from '../lib/analytics'
import { POLAR_CHECKOUT_URL } from '../lib/entitlement'
import { mergeLocalDataIntoAccount } from '../lib/accountMerge'
import { pb } from '../lib/pocketbase'
import { SignupWelcomeBeat } from '../components/SignupWelcomeBeat'

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
  const [checkingEntitlement, setCheckingEntitlement] = useState(false)
  const [welcomeMergedCount, setWelcomeMergedCount] = useState<number | null>(null)

  function trackFormStarted() {
    if (startedRef.current) return
    startedRef.current = true
    trackEvent('Account form started', { source, mode })
  }

  // Picks up entitlement flipped by the Polar webhook after checkout --
  // the cached auth record otherwise only refreshes on the next sign-in.
  useEffect(() => {
    if (user) refreshEntitlement()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-check once per sign-in, not on every user object identity change
  }, [user?.id])

  async function handleRefreshEntitlement() {
    setCheckingEntitlement(true)
    await refreshEntitlement()
    setCheckingEntitlement(false)
  }

  if (user) {
    return (
      <div className="settings-row">
        {welcomeMergedCount != null && (
          <SignupWelcomeBeat mergedCount={welcomeMergedCount} onDone={() => setWelcomeMergedCount(null)} />
        )}
        <span className="settings-label">Account</span>
        <div className="settings-choice">
          <span className="settings-status">{user.email}</span>
          <button type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
        <div className="settings-choice">
          <span className="settings-status">
            {user.entitled ? 'Sky Pass active' : 'Sky Pass not active'}
          </span>
          {user.entitled ? null : (
            <>
              {POLAR_CHECKOUT_URL && (
                <a
                  className="paywall-card-cta"
                  href={POLAR_CHECKOUT_URL}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => trackEvent('Paywall checkout clicked', { feature: 'settings' })}
                >
                  Get the Sky Pass
                </a>
              )}
              <button type="button" onClick={handleRefreshEntitlement} disabled={checkingEntitlement}>
                {checkingEntitlement ? 'Checking…' : 'Refresh status'}
              </button>
            </>
          )}
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
      if (mode === 'sign-in') {
        await signIn(email, password)
        trackEvent('Sign in completed', { source })
      } else {
        await signUp(email, password)
        const userId = pb.authStore.record?.id as string | undefined
        const result = userId
          ? await mergeLocalDataIntoAccount(userId)
          : { favourites: 0, watchlist: 0, observations: 0, cameraPresets: 0, total: 0 }
        trackEvent('Sign up completed', { source, mergedCount: result.total })
        trackEvent('Merge result', {
          source,
          favourites: result.favourites,
          watchlist: result.watchlist,
          observations: result.observations,
          cameraPresets: result.cameraPresets,
          total: result.total,
        })
        setWelcomeMergedCount(result.total)
      }
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
