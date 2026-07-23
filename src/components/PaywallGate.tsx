import { useState, type ReactNode } from 'react'
import { refreshEntitlement, type AuthUser } from '../lib/auth'
import { POLAR_CHECKOUT_URL, startPolarCheckout } from '../lib/entitlement'
import { trackEvent } from '../lib/analytics'

interface PaywallGateProps {
  user: AuthUser | null
  feature: string
  description: string
  onSignInClick: () => void
  children: ReactNode
  freeNote?: string
}

// Wraps a view/tab that requires the one-time Atlas Sky Pass purchase.
// Renders its children unchanged for entitled users; everyone else sees an
// upgrade card instead of the gated content underneath.
export function PaywallGate({ user, feature, description, onSignInClick, children, freeNote }: PaywallGateProps) {
  const [isStartingCheckout, setIsStartingCheckout] = useState(false)
  const [isCheckingPurchase, setIsCheckingPurchase] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [purchaseStatus, setPurchaseStatus] = useState('')

  if (user?.entitled) return <>{children}</>

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
      setPurchaseStatus('Could not reach Atlas. Your saved access has not changed.')
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
          <span>Tonight, 14-day event browsing, check-ins, and your private journal.</span>
        </div>
        <div>
          <strong>Sky Pass unlocks</strong>
          <span>90-day plans, saved targets, reminders, dark sites, gear fit, community, and archive.</span>
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
