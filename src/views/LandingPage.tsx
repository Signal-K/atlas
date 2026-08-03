import { useEffect } from 'react'
import atlasMobilePreview from '../../media/app-screenshots/04-mobile-today-hub.png'
import { trackEvent } from '../lib/analytics'
import './LandingPage.css'

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

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 10h11M11 5l5 5-5 5" />
    </svg>
  )
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.8c.5 5.5 3.7 8.7 9.2 9.2-5.5.5-8.7 3.7-9.2 9.2-.5-5.5-3.7-8.7-9.2-9.2 5.5-.5 8.7-3.7 9.2-9.2Z" />
    </svg>
  )
}

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
    <div className="atlas-landing">
      <header className="atlas-landing-nav">
        <a className="atlas-landing-brand" href="#top" aria-label="Atlas home">
          <img src="/atlas-icon.png" alt="" />
          <span>Atlas</span>
        </a>

        <nav aria-label="Landing page">
          <a href="#features">What it does</a>
          <a href="#camera-presets">Camera presets</a>
          <a href="#daily-transit">The Daily Transit</a>
        </nav>

        <div className="atlas-landing-nav-actions">
          {authenticatedEmail && (
            <span className="atlas-auth-status" title={authenticatedEmail}>
              <i aria-hidden="true" />
              Signed in
            </span>
          )}
          <button type="button" className="atlas-button atlas-button--small" onClick={() => handleEnter('nav')}>
            Open web app
            <ArrowIcon />
          </button>
        </div>
      </header>

      <main id="top">
        <section className="atlas-landing-hero" aria-labelledby="atlas-landing-title">
          <div className="atlas-landing-hero-copy">
            <p className="atlas-kicker">
              <span aria-hidden="true">✦</span>
              A field guide for the sky above you
            </p>
            <h1 id="atlas-landing-title">What can I see in the sky tonight?</h1>
            <p className="atlas-landing-lede">
              Atlas tells you when to go outside, what is visible from wherever you are, and how to actually get a good look at it.
            </p>

            {authenticatedEmail && (
              <p className="atlas-auth-note">
                <span aria-hidden="true" />
                You’re signed in as <strong>{authenticatedEmail}</strong>
              </p>
            )}

            <div className="atlas-landing-hero-actions">
              <button type="button" className="atlas-button atlas-button--primary" onClick={() => handleEnter('hero')}>
                {primaryLabel}
                <ArrowIcon />
              </button>
              <a className="atlas-text-link" href="#features">
                See how Atlas works
              </a>
            </div>

            <p className="atlas-landing-fineprint">Start free in your browser. No telescope required.</p>
          </div>

          <div className="atlas-product-preview" aria-label="A preview of the Atlas web app">
            <div className="atlas-preview-orbit atlas-preview-orbit--one" aria-hidden="true" />
            <div className="atlas-preview-orbit atlas-preview-orbit--two" aria-hidden="true" />
            <div className="atlas-preview-note atlas-preview-note--weather">
              <span>Cloud</span>
              <strong>18%</strong>
              <small>Clear</small>
            </div>
            <div className="atlas-preview-note atlas-preview-note--target">
              <span>Next up</span>
              <strong>Full Moon</strong>
              <small>12:48 AM</small>
            </div>
            <div className="atlas-phone-frame">
              <div className="atlas-phone-speaker" aria-hidden="true" />
              <img
                src={atlasMobilePreview}
                alt="Atlas Today screen showing a live sky map, the next target, cloud cover and darkness"
              />
            </div>
          </div>
        </section>

        <section className="atlas-decision-strip" aria-label="Three questions Atlas helps answer">
          <span>Is the sky clear?</span>
          <i aria-hidden="true" />
          <span>What is up?</span>
          <i aria-hidden="true" />
          <span>How do I catch it?</span>
        </section>

        <section className="atlas-feature-section" id="features" aria-labelledby="atlas-features-title">
          <div className="atlas-section-heading">
            <p className="atlas-kicker">Your night, made legible</p>
            <h2 id="atlas-features-title">Less astronomy homework. More time outside.</h2>
            <p>
              Atlas turns sky data into a small number of useful decisions, without pretending that every forecast is certain.
            </p>
          </div>

          <div className="atlas-feature-grid">
            {FEATURE_CARDS.map((feature) => (
              <article key={feature.number} className="atlas-feature-card">
                <span className="atlas-feature-number">{feature.number}</span>
                <div className="atlas-feature-glyph" aria-hidden="true">
                  <span />
                  <i />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="atlas-presets-section" id="camera-presets" aria-labelledby="atlas-presets-title">
          <div className="atlas-preset-visual" aria-label="An Atlas camera preset for Nothing Phone">
            <div className="atlas-preset-card">
              <div className="atlas-preset-card-topline">
                <span>ATLAS / CAMERA</span>
                <span>NOTHING</span>
              </div>
              <div className="atlas-preset-target">
                <span>Target</span>
                <strong>Milky Way</strong>
              </div>
              <dl>
                <div>
                  <dt>Mode</dt>
                  <dd>Expert / Night</dd>
                </div>
                <div>
                  <dt>Lens</dt>
                  <dd>Main · 1×</dd>
                </div>
                <div>
                  <dt>Focus</dt>
                  <dd>Far / stars</dd>
                </div>
                <div>
                  <dt>Support</dt>
                  <dd>Tripod</dd>
                </div>
              </dl>
              <div className="atlas-preset-file">
                <SparkIcon />
                <span>atlas-milky-way-nothing.atlas-preset.json</span>
              </div>
            </div>
          </div>

          <div className="atlas-presets-copy">
            <p className="atlas-kicker">Camera presets</p>
            <h2 id="atlas-presets-title">A better starting point for your phone.</h2>
            <p className="atlas-presets-intro">
              Download an Atlas preset bundle for the thing you want to photograph and the phone in your hand. Nothing Camera gets dedicated setup guidance, alongside profiles for Pixel, Galaxy, iPhone and other Android phones.
            </p>

            <div className="atlas-preset-explainers">
              <article>
                <span>AI injection</span>
                <h3>Start with a sensible setup</h3>
                <p>Atlas can fill a preset with a suggested setup for the target and conditions. It is a starting point you can inspect, not an automatic camera change.</p>
              </article>
              <article>
                <span>Custom settings</span>
                <h3>Make it yours</h3>
                <p>Adjust mode, lens, ISO, white balance or exposure, then keep the setup in a portable preset file for next time.</p>
              </article>
            </div>

            <p className="atlas-presets-note">
              <strong>A transparent note about Nothing:</strong> Atlas presets download now. Nothing Camera does not currently publish a stable preset-import format, so Atlas gives you clear settings to copy manually until native importing is possible.
            </p>
          </div>
        </section>

        <section className="atlas-transit-section" id="daily-transit" aria-labelledby="atlas-transit-title">
          <div className="atlas-transit-mark" aria-hidden="true">
            <span>TDT</span>
            <i />
            <small>Media arm of Atlas</small>
          </div>

          <div className="atlas-transit-copy">
            <p className="atlas-kicker">The Daily Transit</p>
            <h2 id="atlas-transit-title">The stories behind looking up.</h2>
            <p>
              The Daily Transit is the media arm of Atlas: a podcast interviewing people who use the app, plus written stories and field notes about the night sky.
            </p>
            <a className="atlas-button atlas-button--outline" href="https://thedailytransit.com" target="_blank" rel="noreferrer">
              Visit The Daily Transit
              <ArrowIcon />
            </a>
          </div>
        </section>

        <section className="atlas-final-cta" aria-labelledby="atlas-final-title">
          <p className="atlas-kicker">Tonight is already happening</p>
          <h2 id="atlas-final-title">Find your reason to step outside.</h2>
          <p>Open Atlas, choose your location and see what the sky has for you.</p>
          <button type="button" className="atlas-button atlas-button--primary" onClick={() => handleEnter('final')}>
            {finalLabel}
            <ArrowIcon />
          </button>
        </section>
      </main>

      <footer className="atlas-landing-footer">
        <div className="atlas-landing-brand">
          <img src="/atlas-icon.png" alt="" />
          <span>Atlas</span>
        </div>
        <p>Atlas, a Star Sailors app</p>
        <a href="https://thedailytransit.com" target="_blank" rel="noreferrer">
          The Daily Transit
        </a>
      </footer>
    </div>
  )
}
