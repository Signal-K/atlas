import { useState } from 'react'
import { hasValidSession, refreshEntitlement, type AuthUser } from '../lib/auth'
import { POLAR_CHECKOUT_URL, startPolarCheckout } from '../lib/entitlement'
import { trackEvent } from '../lib/analytics'

export function SubscriptionCard({ user, entitlementRefreshing }: { user: AuthUser; entitlementRefreshing: boolean }) {
  const [isStartingCheckout, setIsStartingCheckout] = useState(false)
  const [isCheckingPurchase, setIsCheckingPurchase] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [purchaseStatus, setPurchaseStatus] = useState('')

  if (entitlementRefreshing) {
    return (
      <div className="ui-card subscription-card" role="status">
        <span className="ui-badge">Sky Pass</span>
        <h2>Checking your access…</h2>
        <p>Atlas is confirming your purchase. This usually takes a moment.</p>
      </div>
    )
  }

  if (user.entitled) {
    return (
      <div className="ui-card subscription-card">
        <span className="ui-badge ui-badge-good">Sky Pass active</span>
        <h2>You have the Sky Pass</h2>
        <p>Thanks for supporting Atlas — this unlocks everything as it ships.</p>
      </div>
    )
  }

  async function handleCheckoutClick() {
    trackEvent('Paywall checkout clicked', { feature: 'account' })
    setCheckoutError('')
    setIsStartingCheckout(true)
    try {
      const refreshedUser = await refreshEntitlement()
      if (refreshedUser?.entitled) return
      const url = await startPolarCheckout()
      window.location.href = url
    } catch {
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
      setPurchaseStatus(
        hasValidSession()
          ? 'Could not reach Atlas. Your saved access has not changed.'
          : 'Your session has expired. Sign in again to restore your Sky Pass.',
      )
    } else if (!refreshedUser.entitled) {
      setPurchaseStatus(`No paid Sky Pass was found for ${refreshedUser.email}.`)
    }
    setIsCheckingPurchase(false)
  }

  return (
    <div className="ui-card subscription-card">
      <span className="ui-badge ui-badge-accent">One-time Sky Pass</span>
      <h2>Upgrade to Sky Pass</h2>
      <p>One purchase, works everywhere you sign in with this email.</p>
      <div className="subscription-card-actions">
        <button type="button" className="ui-button ui-button-primary" onClick={handleCheckoutClick} disabled={isStartingCheckout || isCheckingPurchase}>
          {isStartingCheckout ? 'Starting checkout…' : 'Get the Sky Pass'}
        </button>
        <button type="button" className="ui-button ui-button-ghost" onClick={handleCheckPurchase} disabled={isCheckingPurchase || isStartingCheckout}>
          {isCheckingPurchase ? 'Checking purchase…' : 'Already paid? Check purchase'}
        </button>
      </div>
      {purchaseStatus && <p className="settings-help" role="status">{purchaseStatus}</p>}
      {checkoutError && <p className="account-form-error">{checkoutError}</p>}
    </div>
  )
}
