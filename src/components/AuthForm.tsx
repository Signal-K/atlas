import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClerkProvider, SignIn, SignUp, useAuth as useClerkAuth } from '@clerk/react'
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
            <SignIn routing="hash" appearance={clerkAppearance} fallbackRedirectUrl={window.location.pathname} />
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
