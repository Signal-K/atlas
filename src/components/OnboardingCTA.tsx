import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'

const DISMISSED_KEY = 'atlas-onboarding-dismissed'

export function OnboardingCTA({ onSignUpClick }: { onSignUpClick: () => void }) {
  const { user } = useAuth()
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISSED_KEY) === '1')
  }, [])

  if (user || dismissed) return null

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setDismissed(true)
  }

  return (
    <div className="onboarding-cta">
      <div>
        <p className="onboarding-cta-title">Create a free account</p>
        <p className="onboarding-cta-body">Save observations, pin events across devices, and share discoveries with the community.</p>
      </div>
      <div className="onboarding-cta-actions">
        <button type="button" className="onboarding-cta-primary" onClick={onSignUpClick}>
          Sign up
        </button>
        <button type="button" className="onboarding-cta-dismiss" onClick={dismiss} aria-label="Dismiss">
          ✕
        </button>
      </div>
    </div>
  )
}
