import { useEffect } from 'react'
import { trackEvent } from '../lib/analytics'

interface LandingPageProps {
  authenticatedEmail?: string
  isMobile: boolean
  onEnter: () => void
}

const FEATURE_CARDS = [
  {
    number: '01',
    title: 'Know if tonight is worth it',
    body: 'Atlas combines what is overhead with cloud, moonlight, darkness and your location, then gives you a clear place to start.',
  },
  {
    number: '02',
    title: 'Find it without knowing the sky',
    body: 'Use the live sky map and plain-language directions to work out where to look — from the Moon to a passing satellite.',
  },
  {
    number: '03',
    title: 'Remember what you saw',
    body: 'Save targets, plan a darker-sky trip and keep a private field journal of the nights you actually went outside.',
  },
]

export function LandingPage({ authenticatedEmail, isMobile, onEnter }: LandingPageProps) {
  useEffect(() => {
    trackEvent('Viewed landing page', { isMobile, authenticated: Boolean(authenticatedEmail) })
    // Only track the initial view of this mount, not every viewport change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleEnter(source: 'nav' | 'hero' | 'final') {
    trackEvent('Landing CTA clicked', {
      method: authenticatedEmail ? 'open_app' : 'get_started',
      source,
      isMobile,
    })
    onEnter()
  }

  const primaryLabel = authenticatedEmail ? 'Open Atlas' : 'Get started'
  const finalLabel = authenticatedEmail ? 'Return to Atlas' : 'See tonight’s sky'

  return (
    <div className="headless-public">
      <header className="headless-public-header">
        <a href="#top" aria-label="Atlas home">Atlas</a>
        <button type="button" onClick={() => handleEnter('nav')}>Open web app</button>
      </header>

      <main id="top" className="headless-public-main">
        <section aria-labelledby="atlas-landing-title">
          <p className="eyebrow">A field guide for the sky above you</p>
          <h1 id="atlas-landing-title">What can I see in the sky tonight?</h1>
          <p>Atlas tells you what is visible from wherever you are, when to go outside, and how to get a good look at it.</p>
          {authenticatedEmail && <p role="status">You’re signed in as <strong>{authenticatedEmail}</strong>.</p>}
          <button type="button" onClick={() => handleEnter('hero')}>{primaryLabel}</button>
        </section>

        <section id="features" aria-labelledby="features-title">
          <h2 id="features-title">What Atlas does</h2>
          <ul>
            {FEATURE_CARDS.map((feature) => <li key={feature.number}><strong>{feature.title}</strong><p>{feature.body}</p></li>)}
          </ul>
        </section>

        <section aria-labelledby="camera-presets-title">
          <h2 id="camera-presets-title">Camera presets</h2>
          <p>Choose a target and device, then use Atlas guidance to make a practical setup you can save and reuse.</p>
          <a href="/app/plan">Explore planning and camera setup</a>
        </section>

        <section aria-labelledby="atlas-final-title">
          <h2 id="atlas-final-title">Find your reason to step outside.</h2>
          <p>Start free in your browser. Sky Pass is a one-time upgrade.</p>
          <button type="button" onClick={() => handleEnter('final')}>{finalLabel}</button>
        </section>
      </main>

      <footer className="headless-public-footer"><span>Atlas</span><span>Star Sailors</span></footer>
    </div>
  )
}
