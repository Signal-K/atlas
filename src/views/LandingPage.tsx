import { useEffect } from 'react'
import { trackEvent } from '../lib/analytics'
import { useThemeState } from '../lib/theme'
import { Starfield } from '../components/mobile/Starfield'
import { MobileIcon, type MobileIconName } from '../components/mobile/MobileIcon'

interface LandingPageProps {
  authenticatedEmail?: string
  isMobile: boolean
  onEnter: () => void
}

const FEATURE_CARDS: { icon: MobileIconName; title: string; body: string }[] = [
  {
    icon: 'moon',
    title: 'Know if tonight is worth it',
    body: 'Atlas combines what is overhead with cloud, moonlight, darkness and your location, then gives you a clear place to start.',
  },
  {
    icon: 'eye',
    title: 'Find it without knowing the sky',
    body: 'Use the live sky map and plain-language directions to work out where to look — from the Moon to a passing satellite.',
  },
  {
    icon: 'journal',
    title: 'Remember what you saw',
    body: 'Save targets, plan a darker-sky trip and keep a private field journal of the nights you actually went outside.',
  },
]

export function LandingPage({ authenticatedEmail, isMobile, onEnter }: LandingPageProps) {
  const [theme] = useThemeState()
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
    <div className="headless-public az-landing">
      <header className="headless-public-header az-landing-header">
        <a href="#top" aria-label="Atlas home" className="az-landing-wordmark">Atlas</a>
        <button type="button" className="az-btn az-btn-outline" onClick={() => handleEnter('nav')}>
          Open web app
        </button>
      </header>

      <main id="top" className="headless-public-main az-landing-main">
        <section aria-labelledby="atlas-landing-title" className="az-landing-hero">
          <div className="az-landing-hero-bg">
            <Starfield density={140} palette="multicolour" dark={theme === 'dark'} />
          </div>
          <div className="az-landing-hero-content">
            <p className="az-kicker">A field guide for the sky above you</p>
            <h1 id="atlas-landing-title" className="az-h1 az-landing-title">
              What can I see in the sky tonight?
            </h1>
            <p className="az-muted az-landing-lede">
              Atlas tells you what is visible from wherever you are, when to go outside, and how to get a good look
              at it.
            </p>
            {authenticatedEmail && (
              <p role="status" className="az-muted az-landing-signed-in">
                You’re signed in as <strong className="az-landing-signed-in-email">{authenticatedEmail}</strong>
              </p>
            )}
            <button type="button" className="az-btn az-btn-primary az-landing-cta" onClick={() => handleEnter('hero')}>
              {primaryLabel}
            </button>
          </div>
        </section>

        <section id="features" aria-labelledby="features-title" className="az-landing-section">
          <h2 id="features-title" className="az-kicker az-landing-section-kicker">What Atlas does</h2>
          <ul className="az-landing-features">
            {FEATURE_CARDS.map((feature) => (
              <li key={feature.title} className="az-card az-landing-feature">
                <div className="az-row-icon az-landing-feature-icon">
                  <MobileIcon name={feature.icon} size={18} />
                </div>
                <strong className="az-landing-feature-title">{feature.title}</strong>
                <p className="az-muted az-landing-feature-body">{feature.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="camera-presets-title" className="az-card az-landing-section az-landing-presets">
          <div className="az-card-body">
            <h2 id="camera-presets-title" className="az-landing-presets-title">Camera presets</h2>
            <p className="az-muted">
              Choose a target and device, then use Atlas guidance to make a practical setup you can save and reuse.
            </p>
            <a href="/app/planner" className="az-landing-presets-link">Explore planning and camera setup →</a>
          </div>
        </section>

        <section aria-labelledby="atlas-final-title" className="az-landing-final">
          <h2 id="atlas-final-title" className="az-h1 az-landing-final-title">Find your reason to step outside.</h2>
          <p className="az-muted">Start free in your browser. Sky Pass is a one-time upgrade.</p>
          <button type="button" className="az-btn az-btn-primary az-landing-cta" onClick={() => handleEnter('final')}>
            {finalLabel}
          </button>
        </section>
      </main>

      <footer className="headless-public-footer az-landing-footer">
        <span>Atlas</span>
        <span className="az-muted">Star Sailors</span>
      </footer>
    </div>
  )
}
