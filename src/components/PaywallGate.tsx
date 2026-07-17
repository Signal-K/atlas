import type { ReactNode } from 'react'
import type { AuthUser } from '../lib/auth'
import { POLAR_CHECKOUT_URL } from '../lib/entitlement'
import { trackEvent } from '../lib/analytics'

interface PaywallGateProps {
  user: AuthUser | null
  feature: string
  description: string
  onSignInClick: () => void
  children: ReactNode
}

// Wraps a view/tab that requires the one-time Atlas Sky Pass purchase.
// Renders its children unchanged for entitled users; everyone else sees an
// upgrade card instead of the gated content underneath.
export function PaywallGate({ user, feature, description, onSignInClick, children }: PaywallGateProps) {
  if (user?.entitled) return <>{children}</>

  return (
    <div className="paywall-card">
      <h2>{feature} is part of the Sky Pass</h2>
      <p>{description}</p>
      {!user && <p className="paywall-card-note">Create a free account first, then upgrade.</p>}
      <div className="paywall-card-actions">
        {!user ? (
          <button type="button" onClick={onSignInClick}>
            Sign in / create account
          </button>
        ) : POLAR_CHECKOUT_URL ? (
          <a
            className="paywall-card-cta"
            href={POLAR_CHECKOUT_URL}
            target="_blank"
            rel="noreferrer"
            onClick={() => trackEvent('Paywall checkout clicked', { feature })}
          >
            Get the Sky Pass
          </a>
        ) : (
          <p className="paywall-card-note">Checkout isn't configured yet -- check back soon.</p>
        )}
      </div>
    </div>
  )
}
