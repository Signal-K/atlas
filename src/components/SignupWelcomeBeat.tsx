import { useEffect } from 'react'
import { trackEvent } from '../lib/analytics'

interface SignupWelcomeBeatProps {
  mergedCount: number
  onDone: () => void
}

export function SignupWelcomeBeat({ mergedCount, onDone }: SignupWelcomeBeatProps) {
  useEffect(() => {
    trackEvent('Completed welcome beat', { mergedCount })
    const timeout = window.setTimeout(onDone, 3000)
    return () => window.clearTimeout(timeout)
  }, [mergedCount, onDone])

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-modal signup-welcome-beat" role="status" aria-live="polite">
        <div className="signup-welcome-orbit" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <h2>Atlas is watching the sky with you.</h2>
        <p>Each night, we check timing and weather for targets you care about, then nudge you when it is worth stepping outside.</p>
        <small>
          {mergedCount > 0
            ? `${mergedCount} saved item${mergedCount === 1 ? '' : 's'} carried into your account.`
            : 'Your current plan stays right where it is.'}
        </small>
      </div>
    </div>
  )
}
