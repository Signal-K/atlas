import { useEffect, useRef, useState } from 'react'
import { authErrorMessage, signIn, signUp } from '../lib/auth'
import { mergeLocalDataIntoAccount, type MergeResult } from '../lib/accountMerge'
import { pb } from '../lib/pocketbase'
import { trackEvent } from '../lib/analytics'

export type SignupWallReason = 'favourite' | 'log_observation'

const REASON_COPY: Record<SignupWallReason, string> = {
  favourite: 'Create a free account to keep this favourite across devices.',
  log_observation: 'Create a free account to keep this observation across devices.',
}

interface SignupWallModalProps {
  reason: SignupWallReason
  onDismiss: () => void
  onSignedUp: (mergedCount: number) => void
}

// Shown after a signed-out visitor saves something worth keeping (STS-303/320)
// -- never blocks the save itself, which already happened locally before
// this renders. Signing up here also folds everything saved so far into the
// new account (STS-322), since local data is scoped to a fixed 'local' id
// until an account exists.
export function SignupWallModal({ reason, onDismiss, onSignedUp }: SignupWallModalProps) {
  const [mode, setMode] = useState<'sign-up' | 'sign-in'>('sign-up')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const shownRef = useRef(false)

  useEffect(() => {
    if (shownRef.current) return
    shownRef.current = true
    trackEvent('Signup wall shown', { reason })
  }, [reason])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    trackEvent('Signup wall submitted', { reason, mode })
    try {
      if (mode === 'sign-up') await signUp(email, password)
      else await signIn(email, password)

      const userId = pb.authStore.record?.id as string | undefined
      const emptyResult: MergeResult = { favourites: 0, watchlist: 0, observations: 0, cameraPresets: 0, total: 0 }
      const result = userId ? await mergeLocalDataIntoAccount(userId) : emptyResult
      trackEvent(mode === 'sign-up' ? 'Sign up completed' : 'Sign in completed', {
        source: `signup_wall_${reason}`,
        mergedCount: result.total,
      })
      trackEvent('Merge result', {
        source: `signup_wall_${reason}`,
        favourites: result.favourites,
        watchlist: result.watchlist,
        observations: result.observations,
        cameraPresets: result.cameraPresets,
        total: result.total,
      })
      onSignedUp(result.total)
    } catch (submitError) {
      const fallback = mode === 'sign-up' ? 'Sign-up failed.' : 'Sign-in failed — check your email and password.'
      setError(authErrorMessage(submitError, fallback))
      trackEvent(mode === 'sign-up' ? 'Sign up failed' : 'Sign in failed', { reason })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-modal signup-wall-modal">
        <h2>Save this to your account</h2>
        <p>{REASON_COPY[reason]}</p>
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
              {mode === 'sign-up' ? 'Create account' : 'Sign in'}
            </button>
            <button type="button" className="account-form-switch" onClick={() => setMode(mode === 'sign-up' ? 'sign-in' : 'sign-up')}>
              {mode === 'sign-up' ? 'Have an account?' : 'Need an account?'}
            </button>
          </div>
          {error && <p className="account-form-error">{error}</p>}
        </form>
        <button
          type="button"
          className="onboarding-skip"
          onClick={() => {
            trackEvent('Signup wall dismissed', { reason })
            onDismiss()
          }}
        >
          Not now
        </button>
      </div>
    </div>
  )
}
