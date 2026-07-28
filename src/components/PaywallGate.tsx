import { useState, type ReactNode } from 'react'
import { hasValidSession, refreshEntitlement, type AuthUser, useAuth } from '../lib/auth'
import { POLAR_CHECKOUT_URL, startPolarCheckout } from '../lib/entitlement'
import { trackEvent } from '../lib/analytics'

interface PaywallGateProps {
  user: AuthUser | null
  entitlementRefreshing?: boolean
  feature: string
  description: string
  onSignInClick: () => void
  children: ReactNode
  freeNote?: string
  // Lets a specific gate (e.g. the Plan tab) state what it actually offers
  // instead of the generic app-wide summary -- defaults preserve the
  // existing copy for every other call site (search, watchlist, dark-sites).
  freeBullets?: string
  paidBullets?: string
}

// Wraps a view/tab that requires the one-time Atlas Sky Pass purchase.
// Renders its children unchanged for entitled users; everyone else sees an
// upgrade card instead of the gated content underneath.
export function PaywallGate({
  user,
  entitlementRefreshing = false,
  feature,
  description,
  onSignInClick,
  children,
  freeNote,
  freeBullets = 'Tonight, 14-day event browsing, check-ins, and your private journal.',
  paidBullets = '90-day plans, saved targets, reminders, dark sites, gear fit, community, and archive.',
}: PaywallGateProps) {
  const { entitlementRefreshing: authEntitlementRefreshing } = useAuth()
  const isEntitlementRefreshing = entitlementRefreshing || (user != null && authEntitlementRefreshing)
  const [isStartingCheckout, setIsStartingCheckout] = useState(false)
  const [isCheckingPurchase, setIsCheckingPurchase] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [purchaseStatus, setPurchaseStatus] = useState('')

  if (user?.entitled) return <>{children}</>

  if (user && isEntitlementRefreshing) {
    return (
      <div className="paywall-card paywall-card--checking" role="status">
        <span className="paywall-card-badge">Sky Pass</span>
        <h2>Checking your access…</h2>
        <p>Atlas is confirming your purchase. This usually takes a moment.</p>
      </div>
    )
  }

  async function handleCheckoutClick() {
    trackEvent('Paywall checkout clicked', { feature })
    setCheckoutError('')
    setIsStartingCheckout(true)
    try {
      const refreshedUser = await refreshEntitlement()
      if (refreshedUser?.entitled) return
      const url = await startPolarCheckout()
      window.location.href = url
    } catch {
      // Dynamic checkout unavailable (PocketBase unreachable, not
      // configured, etc.) -- fall back to the static checkout link rather
      // than stranding the user on a spinner.
      if (POLAR_CHECKOUT_URL) {
        window.location.href = POLAR_CHECKOUT_URL
      } else {
        setCheckoutError('Could not start checkout. If you already paid, refresh the page; otherwise try again shortly.')
        setIsStartingCheckout(false)
      }
    }
  }

  async function handleCheckPurchase() {
    setIsCheckingPurchase(true)
    setPurchaseStatus('')
    const refreshedUser = await refreshEntitlement()
    if (!refreshedUser) {
      // Two very different causes, and the advice differs: an expired session
      // can only be fixed by signing in again, which no amount of retrying or
      // waiting for the network will do.
      setPurchaseStatus(
        hasValidSession()
          ? 'Could not reach Atlas. Your saved access has not changed.'
          : 'Your session has expired. Sign in again to restore your Sky Pass.',
      )
    } else if (!refreshedUser.entitled) {
      setPurchaseStatus(`No paid Sky Pass was found for ${refreshedUser.email}. If you paid with another email, sign in with that account.`)
    }
    setIsCheckingPurchase(false)
  }

  return (
    <div className="paywall-card">
      <span className="paywall-card-badge">One-time Sky Pass</span>
      <h2>Unlock {feature} with Sky Pass</h2>
      <p>{description}</p>
      <div className="paywall-card-breakdown">
        <div>
          <strong>Always free</strong>
          <span>{freeBullets}</span>
        </div>
        <div>
          <strong>Sky Pass unlocks</strong>
          <span>{paidBullets}</span>
        </div>
      </div>
      <p className="paywall-card-note">One purchase works on desktop and mobile when you sign in with the same email.</p>
      {freeNote && <p className="paywall-card-note">{freeNote}</p>}
      {!user && <p className="paywall-card-note">Create a free account first, then upgrade.</p>}
      {user && <p className="paywall-card-account">Signed in as <strong>{user.email}</strong> · no Sky Pass found on this account.</p>}
      <div className="paywall-card-actions">
        {!user ? (
          <button type="button" className="paywall-card-cta" onClick={onSignInClick}>
            Sign in / create account
          </button>
        ) : (
          <>
            <button
              type="button"
              className="paywall-card-cta"
              onClick={handleCheckoutClick}
              disabled={isStartingCheckout || isCheckingPurchase}
            >
              {isStartingCheckout ? 'Starting checkout…' : 'Get the Sky Pass'}
            </button>
            <button
              type="button"
              className="paywall-card-secondary"
              onClick={handleCheckPurchase}
              disabled={isCheckingPurchase || isStartingCheckout}
            >
              {isCheckingPurchase ? 'Checking purchase…' : 'Already paid? Check purchase'}
            </button>
          </>
        )}
      </div>
      {purchaseStatus && <p className="paywall-card-note" role="status">{purchaseStatus}</p>}
      {checkoutError && <p className="paywall-card-note">{checkoutError}</p>}
    </div>
  )
}
