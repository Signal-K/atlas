import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClerkProvider, SignUp, useAuth as useClerkAuth, useSignIn } from '@clerk/react'
import type { RecordModel } from 'pocketbase'
import { trackEvent } from '../lib/analytics'
import { mergeLocalDataIntoAccount } from '../lib/accountMerge'
import { pb, pocketBaseUrl } from '../lib/pocketbase'
import { redeemStoredDemoAccessCode } from '../lib/demoAccess'

export interface AuthFormProps {
  defaultMode?: 'sign-in' | 'sign-up'
  source: string
  intro?: ReactNode
  // Only relevant when the Clerk exchange reports a brand-new PocketBase
  // account: how many locally-saved records (from before this account
  // existed) got merged in. Settings uses this to show SignupWelcomeBeat;
  // other callers can ignore it.
  onSignedUp?: (mergedCount: number) => void
  onSignedIn?: () => void
  onModeChange?: (mode: 'sign-in' | 'sign-up') => void
}

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined

// Suppresses each Clerk widget's own "Sign up"/"Sign in" footer link --
// KES-188 deliberately replaced a hard-to-notice mode-switch link with
// prominent tabs, so this form owns mode switching alone. Two live
// switchers with no state link between them (Clerk's footer link swaps its
// own internal view; it has no way to also flip our `mode` tab) would just
// reintroduce that bug in a different spot.
const clerkAppearance = { elements: { footerAction: { display: 'none' } } }

// Shared sign-in/sign-up form, used both embedded in Settings (signed-out
// state) and as the full-screen AuthGate shown before onboarding. Renders
// Clerk's own <SignIn>/<SignUp> for credential verification (KES-189) --
// this component's own job is just the mode tabs and the handoff once
// Clerk reports a session: exchange it for a PocketBase token via
// POST /auth/clerk-exchange (backend/clerk_exchange.go) and store that in
// pb.authStore exactly like the old password-based signIn/signUp did, so
// every pb.authStore.record?.id read and PocketBase collection rule
// downstream keeps working unchanged.
export function AuthForm(props: AuthFormProps) {
  const navigate = useNavigate()
  if (!clerkPublishableKey) {
    return (
      <div className="settings-row settings-row--account">
        {props.intro}
        <p className="account-form-error">Sign-in is not configured on this deployment.</p>
      </div>
    )
  }
  return (
    // Without routerPush/routerReplace, Clerk falls back to a real
    // window.location navigation for its own redirects (e.g. after a
    // completed sign-up) -- that's a hard reload in this SPA, remounting
    // this component and losing the in-flight exchange before it can run.
    // Routing it through react-router keeps it entirely client-side.
    <ClerkProvider publishableKey={clerkPublishableKey} routerPush={(to) => navigate(to)} routerReplace={(to) => navigate(to, { replace: true })}>
      <AuthFormContent {...props} />
    </ClerkProvider>
  )
}

function AuthFormContent({ defaultMode = 'sign-in', source, intro, onSignedUp, onSignedIn, onModeChange }: AuthFormProps) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>(defaultMode)
  const [error, setError] = useState<string | null>(null)
  const [exchanging, setExchanging] = useState(false)
  const { isLoaded, isSignedIn, getToken } = useClerkAuth()
  // Clerk reports isSignedIn as soon as its own widget completes; this
  // guards the exchange call to run exactly once per session rather than
  // once per re-render, and lets a failed exchange be retried by flipping
  // back to false.
  const exchangeStartedRef = useRef(false)
  // Only fire "started" once per mount, on the visitor's first interaction
  // with the widget -- not on every keystroke.
  const startedRef = useRef(false)

  function trackFormStarted() {
    if (startedRef.current) return
    startedRef.current = true
    trackEvent('Account form started', { source, mode })
  }

  function switchMode(nextMode: 'sign-in' | 'sign-up') {
    if (nextMode === mode) return
    setMode(nextMode)
    setError(null)
    onModeChange?.(nextMode)
  }

  useEffect(() => {
    if (!isLoaded || !isSignedIn || exchangeStartedRef.current) return
    exchangeStartedRef.current = true
    void exchangeClerkSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- exchangeClerkSession closes over mode/source, which only matter for analytics on the one run this effect triggers
  }, [isLoaded, isSignedIn])

  async function exchangeClerkSession() {
    setError(null)
    setExchanging(true)
    trackEvent('Account form submitted', { source, mode })
    try {
      const clerkToken = await getToken()
      if (!clerkToken) throw new Error('No Clerk session token available.')

      const response = await fetch(`${pocketBaseUrl}/auth/clerk-exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: clerkToken }),
      })
      const payload = (await response.json().catch(() => null)) as
        | { token: string; record: RecordModel; meta?: { created?: boolean } }
        | { message?: string }
        | null
      if (!response.ok || !payload || !('token' in payload)) {
        throw new Error((payload as { message?: string } | null)?.message ?? 'Could not complete sign-in.')
      }
      pb.authStore.save(payload.token, payload.record)

      const demoAccess = await redeemStoredDemoAccessCode()
      const created = payload.meta?.created ?? false
      if (!created) {
        trackEvent('Sign in completed', { source, demoAccess })
        onSignedIn?.()
        return
      }

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong finishing sign-in.')
      trackEvent(mode === 'sign-in' ? 'Sign in failed' : 'Sign up failed', { source })
      // Allow retrying (e.g. the exchange endpoint was briefly unreachable)
      // without needing to sign out of Clerk and back in.
      exchangeStartedRef.current = false
    } finally {
      setExchanging(false)
    }
  }

  return (
    <div className="settings-row settings-row--account" onFocusCapture={trackFormStarted}>
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

        <div className="account-form">
          {/* Without an explicit redirect target, Clerk navigates the browser
              to its Dashboard-configured default path once sign-in/sign-up
              completes -- a real navigation that unmounts this component
              before the isSignedIn effect below gets to run the exchange.
              Redirecting back to wherever this form already is keeps that
              handoff entirely in our own effect instead. */}
          {mode === 'sign-in' ? (
            <ClerkSignInPanel formError={error} setFormError={setError} exchanging={exchanging} />
          ) : (
            <SignUp routing="hash" appearance={clerkAppearance} fallbackRedirectUrl={window.location.pathname} />
          )}
          {exchanging && <p className="settings-help">Finishing sign-in…</p>}
          {error && <p className="account-form-error">{error}</p>}
        </div>
      </div>
    </div>
  )
}

// Hand-rolled in place of Clerk's prebuilt <SignIn> (KES-190) so a failed
// password attempt can be told apart from "this account doesn't exist in
// Clerk yet" -- the prebuilt widget doesn't expose that distinction, and
// it's exactly the case every account created before this migration hits
// on its first sign-in since Clerk never learned their PocketBase
// password. See claimLegacyAccount below and backend/clerk_claim.go.
function ClerkSignInPanel({
  formError,
  setFormError,
  exchanging,
}: {
  formError: string | null
  setFormError: (error: string | null) => void
  exchanging: boolean
}) {
  const { signIn, fetchStatus } = useSignIn()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [claiming, setClaiming] = useState(false)
  const busy = fetchStatus === 'fetching' || claiming || exchanging

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!signIn || busy) return
    setFormError(null)

    let error
    try {
      ;({ error } = await signIn.password({ identifier: email, password }))
    } catch {
      setFormError('Something went wrong. Please try again.')
      return
    }
    if (!error) {
      await signIn.finalize()
      return
    }

    // signIn.password()'s rejection is a ClerkAPIResponseError: the
    // field-level code we need to distinguish "no such account" from
    // "wrong password" lives in .errors[0].code, not .code itself (that's
    // the wrapper's own generic 'api_response_error').
    const fieldCode = (error as { errors?: Array<{ code?: string }> }).errors?.[0]?.code
    if (fieldCode !== 'form_identifier_not_found') {
      setFormError(error.longMessage || error.message || 'Incorrect email or password.')
      return
    }

    // Clerk has never heard of this email -- almost certainly a
    // pre-migration account, since every real signup goes through <SignUp>
    // first. Silently claim it rather than showing an error a returning
    // user has no way to act on.
    setClaiming(true)
    try {
      const claimed = await claimLegacyAccount(email, password)
      if (!claimed) {
        setFormError('Incorrect email or password.')
        return
      }
      const { error: ticketError } = await signIn.ticket({ ticket: claimed })
      if (ticketError) {
        setFormError('Incorrect email or password.')
        return
      }
      await signIn.finalize()
    } finally {
      setClaiming(false)
    }
  }

  async function handleGoogle() {
    if (!signIn) return
    setFormError(null)
    const redirectUrl = window.location.href
    const { error } = await signIn.sso({ strategy: 'oauth_google', redirectUrl, redirectCallbackUrl: redirectUrl })
    if (error) setFormError(error.longMessage || error.message || 'Could not start Google sign-in.')
  }

  return (
    <form className="account-form" onSubmit={handleSubmit}>
      <button type="button" className="account-form-google" onClick={handleGoogle} disabled={busy}>
        Continue with Google
      </button>
      <div className="account-form-divider">or</div>
      <div className="account-form-field">
        <label htmlFor="clerk-sign-in-email">Email address</label>
        <input
          id="clerk-sign-in-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      <div className="account-form-field">
        <label htmlFor="clerk-sign-in-password">Password</label>
        <input
          id="clerk-sign-in-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>
      <div className="account-form-actions">
        <button type="submit" className="account-form-submit" disabled={busy}>
          {claiming ? 'Signing in…' : 'Continue'}
        </button>
      </div>
      {!formError && !exchanging && claiming && (
        <p className="settings-help">Setting up your account for the new sign-in…</p>
      )}
    </form>
  )
}

// POST /auth/clerk-claim (backend/clerk_claim.go) admin-creates a Clerk user
// for a pre-migration PocketBase account and returns a one-time sign-in
// token to redeem via signIn.ticket() -- no OTP round-trip, since the
// product decision (KES-190) is to not require email verification yet.
// Returns null on any failure (account doesn't exist, or already claimed --
// the backend 409s that case so a real wrong-password attempt on an
// already-migrated account still fails normally).
async function claimLegacyAccount(email: string, password: string): Promise<string | null> {
  try {
    const response = await fetch(`${pocketBaseUrl}/auth/clerk-claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const payload = (await response.json().catch(() => null)) as { token?: string } | null
    if (!response.ok || !payload?.token) return null
    return payload.token
  } catch {
    return null
  }
}
