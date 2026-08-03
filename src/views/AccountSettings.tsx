import { useEffect, useState } from 'react'
import { refreshEntitlement, signOut, useAuth } from '../lib/auth'
import { trackEvent } from '../lib/analytics'
import { POLAR_CHECKOUT_URL, startPolarCheckout } from '../lib/entitlement'
import { SignupWelcomeBeat } from '../components/SignupWelcomeBeat'
import { AccountManagement } from '../components/AccountManagement'
import { AuthForm } from '../components/AuthForm'

export function AccountSettings({
  defaultMode = 'sign-in',
  source = 'settings',
}: {
  defaultMode?: 'sign-in' | 'sign-up'
  source?: string
}) {
  const { user, entitlementRefreshing } = useAuth()
  const [checkingEntitlement, setCheckingEntitlement] = useState(false)
  const [startingCheckout, setStartingCheckout] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [welcomeMergedCount, setWelcomeMergedCount] = useState<number | null>(null)

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

  async function handleCheckoutClick() {
    setStartingCheckout(true)
    setCheckoutError('')
    trackEvent('Paywall checkout clicked', { feature: 'settings' })
    try {
      const refreshedUser = await refreshEntitlement()
      if (refreshedUser?.entitled) return
      const url = await startPolarCheckout()
      window.location.href = url
    } catch {
      if (POLAR_CHECKOUT_URL) {
        window.location.href = POLAR_CHECKOUT_URL
      } else {
        setCheckoutError('Could not start checkout. If you already paid, refresh your Sky Pass status; otherwise try again shortly.')
        setStartingCheckout(false)
      }
    }
  }

  if (user) {
    return (
      <div className="settings-account">
        {welcomeMergedCount != null && (
          <SignupWelcomeBeat mergedCount={welcomeMergedCount} onDone={() => setWelcomeMergedCount(null)} />
        )}
        <div className="settings-account-summary">
          <div>
            <span className="settings-account-email">{user.email}</span>
            <p className="settings-pass-explainer">
              {user.entitled
                ? 'Lifetime Sky Pass access is active on desktop and mobile for this account.'
                : entitlementRefreshing
                  ? 'Checking the payment account used for this email…'
                  : 'Free account. Sky Pass is a one-time purchase tied to the email used at checkout.'}
            </p>
          </div>
          <span className={`settings-status settings-status--pill ${user.entitled ? 'settings-status--positive' : entitlementRefreshing ? '' : 'settings-status--warning'}`}>
            {user.entitled ? 'Sky Pass active' : entitlementRefreshing ? 'Checking access…' : 'Free account'}
          </span>
        </div>
        <div className="settings-account-actions">
          <button type="button" onClick={signOut}>
            Sign out
          </button>
          {user.entitled || entitlementRefreshing ? null : (
            <>
              <button type="button" className="paywall-card-cta" onClick={handleCheckoutClick} disabled={startingCheckout}>
                {startingCheckout ? 'Starting checkout…' : 'Get the Sky Pass'}
              </button>
              <button type="button" onClick={handleRefreshEntitlement} disabled={checkingEntitlement}>
                {checkingEntitlement ? 'Checking purchase…' : 'Already paid? Check purchase'}
              </button>
            </>
          )}
        </div>
        {checkoutError && <p className="settings-help settings-status--negative">{checkoutError}</p>}
        <AccountManagement email={user.email} />
      </div>
    )
  }

  return (
    <AuthForm
      defaultMode={defaultMode}
      source={source}
      intro={
        <p className="settings-help">
          Everything you've saved in this browser (favourites, watchlist, observations) stays right here, account or
          not. Create a free account any time to sync it across your devices — nothing already saved is lost either
          way.
        </p>
      }
      onSignedUp={setWelcomeMergedCount}
    />
  )
}
