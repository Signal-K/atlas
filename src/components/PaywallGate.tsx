import { useState, type ReactNode } from 'react'
import type { AuthUser } from '../lib/auth'
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
// Kill switch for the whole paywall, independent of entitlement -- e.g. for
// stretches where checkout can't actually complete (Polar account pending
// approval, webhook outage) and gating would just lock paying-intent users
// out of the app for no reason. Defaults to enabled; set
// VITE_SKY_PASS_ENABLED=false to unlock every gated surface for everyone.
const SKY_PASS_ENABLED = import.meta.env.VITE_SKY_PASS_ENABLED !== 'false'

export function PaywallGate({ user, feature, description, onSignInClick, children, freeNote }: PaywallGateProps) {
  const [isStartingCheckout, setIsStartingCheckout] = useState(false)

  if (!SKY_PASS_ENABLED || user?.entitled) return <>{children}</>

  async function handleCheckoutClick() {
    trackEvent('Paywall checkout clicked', { feature })
    setIsStartingCheckout(true)
    try {
      const url = await startPolarCheckout()
      window.location.href = url
    } catch {
      // Dynamic checkout unavailable (PocketBase unreachable, not
      // configured, etc.) -- fall back to the static checkout link rather
      // than stranding the user on a spinner.
      if (POLAR_CHECKOUT_URL) {
        window.location.href = POLAR_CHECKOUT_URL
      } else {
        setIsStartingCheckout(false)
      }
    }
  }

  return (
    <div className="paywall-card">
      <span className="paywall-card-badge">Sky Pass</span>
      <h2>{feature} is part of the Sky Pass</h2>
      <p>{description}</p>
      {freeNote && <p className="paywall-card-note">{freeNote}</p>}
      {!user && <p className="paywall-card-note">Create a free account first, then upgrade.</p>}
      <div className="paywall-card-actions">
        {!user ? (
          <button type="button" className="paywall-card-cta" onClick={onSignInClick}>
            Sign in / create account
          </button>
        ) : (
          <button
            type="button"
            className="paywall-card-cta"
            onClick={handleCheckoutClick}
            disabled={isStartingCheckout}
          >
            {isStartingCheckout ? 'Starting checkout…' : 'Get the Sky Pass'}
          </button>
        )}
      </div>
    </div>
  )
}
