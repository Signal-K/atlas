import { useEffect } from 'react'
import { trackEvent } from '../lib/analytics'

interface LandingPageProps {
  isMobile: boolean
  onEnter: () => void
}

// What Atlas does, not what it needs from you -- location used to be asked
// for right here, before a first-time visitor had seen anything about the
// product. It's now asked as part of OnboardingFlow's own "location" step
// (with a "use my current location" option there), once someone has
// actually chosen to get started.
const PITCH_POINTS = [
  'Tonight’s best target, picked for your phone — no telescope needed',
  'Camera guidance for what’s actually in your sky right now',
  'A nudge before it’s gone',
]

export function LandingPage({ isMobile, onEnter }: LandingPageProps) {
  useEffect(() => {
    trackEvent('Viewed landing page', { isMobile })
    // Only ever track the initial view of this mount, not on every
    // isMobile flip (e.g. a window resize crossing the breakpoint).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleEnter() {
    trackEvent('Landing CTA clicked', { method: 'get_started', isMobile })
    onEnter()
  }

  const cta = (
    <>
      <ul className={isMobile ? 'dt-landing-pitch-points' : 'landing-pitch-points'}>
        {PITCH_POINTS.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <button type="button" className={isMobile ? 'dt-landing-cta-primary' : 'landing-cta-primary'} onClick={handleEnter}>
        Get started
      </button>
      <p className="landing-pricing">Free to use. Sky Pass — trip/deep-sky planning and the community feed — is a one-time CHF 55 upgrade, forever.</p>
    </>
  )

  if (isMobile) {
    return (
      <div className="dt-landing">
        <div className="dt-landing-hero">
          <img src="/atlas-icon.png" alt="" className="brand-mark brand-mark--landing" />
          <h1>What can I see in the sky tonight?</h1>
          <p>Atlas tells you when to go outside, what&apos;s visible from wherever you are, and how to actually get a good look at it.</p>
          {cta}
        </div>
      </div>
    )
  }

  return (
    <div className="landing-page">
      <div className="landing-hero">
        <img src="/atlas-icon.png" alt="" className="brand-mark brand-mark--landing" />
        <h1>What can I see in the sky tonight?</h1>
        <p>Atlas tells you when to go outside, what&apos;s visible from wherever you are, and how to actually get a good look at it.</p>
        {cta}
      </div>
    </div>
  )
}
