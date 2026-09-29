import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { trackEvent } from '../lib/analytics'

const HOST_CONTACT_EMAIL = 'liam@skinetics.tech'

const EVENING_STEPS = [
  {
    title: 'A short talk',
    body: '20–30 minutes on that week’s sky and the featured event, pitched to beginners and curious students.',
  },
  {
    title: 'Atlas in use',
    body: 'A brief demonstration of how to decide what to see and when from the host city.',
  },
  {
    title: 'Observe and photograph',
    body: 'Outdoor sky watching and, where suitable, a photography component. Bad weather changes the outdoor portion; the indoor fallback is agreed with the host.',
  },
]

const HOST_BRIEF: Array<{ label: string; value: string }> = [
  { label: 'Audience', value: 'Students and the public; no astronomy background needed.' },
  { label: 'Admission', value: 'Free for these practice sky nights.' },
  { label: 'Atlas brings', value: 'The talk, the app demonstration, a camera and binoculars when travelling; any further equipment is agreed in advance.' },
  { label: 'Host helps with', value: 'An accessible indoor talk space, sharing with members or students, and observing space or equipment if available.' },
  { label: 'Timing and weather', value: 'The date is chosen around a worthwhile sky event and venue availability, with an indoor-only or reschedule plan agreed upfront.' },
]

const HOST_FAQS: Array<{ question: string; answer: string }> = [
  { question: 'What happens if it is cloudy?', answer: 'An indoor talk and app demonstration may still work; rescheduling is discussed with the venue.' },
  { question: 'Does the host need a telescope?', answer: 'No blanket requirement; observing equipment and setup are agreed case by case.' },
  { question: 'Is this a sales event?', answer: 'Admission is free and Atlas is free to use by default; any optional Sky Pass is explained clearly, not sold at the event.' },
  { question: 'How many guests?', answer: 'Depends on the room and host arrangements. There is no fixed global capacity.' },
]

export function HostPage() {
  useEffect(() => {
    trackEvent('Viewed host page', {})
  }, [])

  return (
    <div className="atlas-almanac">
      <header className="am-masthead">
        <div className="am-masthead-meta">
          <span>For hosts</span>
          <Link to="/">← Atlas</Link>
        </div>
        <div className="am-masthead-title">
          <div className="am-wordmark">ATLAS</div>
          <div className="am-tagline">Bring a sky night to your community</div>
        </div>
        <nav className="am-nav" aria-label="Primary">
          <div className="am-nav-links">
            <Link to="/#week">Highlights</Link>
            <Link to="/#nights">Sky nights</Link>
            <Link to="/#access">Sky Pass</Link>
          </div>
          <a className="am-nav-cta" href={`mailto:${HOST_CONTACT_EMAIL}`}>
            Discuss a sky night →
          </a>
        </nav>
      </header>

      <main id="top">
        <section className="am-lede" aria-labelledby="am-host-hero-title">
          <div className="am-lede-copy">
            <h1 id="am-host-hero-title">Bring a sky night to your community.</h1>
            <div className="am-lede-columns">
              <p>
                Atlas is a stargazing app and a series of free public observing nights. We choose something worth
                seeing in the sky, explain it in plain language, use Atlas to plan the view, then go outside
                together when the weather allows.
              </p>
            </div>
            <div className="am-lede-actions">
              <a className="am-btn am-btn-primary" href={`mailto:${HOST_CONTACT_EMAIL}`}>
                Discuss a sky night
              </a>
              <span className="am-lede-note">Email {HOST_CONTACT_EMAIL} to talk through audience, city, date, room and equipment.</span>
            </div>
          </div>
        </section>

        <section className="am-section am-evening" aria-labelledby="am-evening-title">
          <div className="am-section-head">
            <h2 id="am-evening-title">The evening</h2>
          </div>
          <div className="am-steps-table" role="table" aria-label="How a sky night runs">
            {EVENING_STEPS.map((step, index) => (
              <div className="am-steps-row" role="row" key={step.title}>
                <div className="am-steps-index" role="cell">{index + 1}.</div>
                <div className="am-steps-title" role="cell">{step.title}</div>
                <div className="am-steps-desc" role="cell">{step.body}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="am-section am-brief" aria-labelledby="am-brief-title">
          <div className="am-section-head">
            <h2 id="am-brief-title">Practical host brief</h2>
          </div>
          <div className="am-brief-table" role="table" aria-label="Practical host brief">
            {HOST_BRIEF.map((row) => (
              <div className="am-brief-row" role="row" key={row.label}>
                <div className="am-brief-label" role="cell">{row.label}</div>
                <div className="am-brief-value" role="cell">{row.value}</div>
              </div>
            ))}
          </div>
          <div className="am-week-foot">
            <span>Ready to set a date? Email {HOST_CONTACT_EMAIL} and we'll agree audience, city, date, room and equipment together.</span>
            <a className="am-link-btn" href={`mailto:${HOST_CONTACT_EMAIL}`}>
              Discuss a sky night →
            </a>
          </div>
        </section>

        <section className="am-section am-app-at-event" aria-labelledby="am-app-at-event-title">
          <div className="am-section-head">
            <h2 id="am-app-at-event-title">The app at the event</h2>
          </div>
          <div className="am-plan am-plan--compact">
            <p>
              Atlas is free to start. People can use it during the event without buying a subscription.
            </p>
            <p>
              For photography groups, we point out the actual sky target and lighting for the night, and what
              people can realistically try shooting. Not every night is a photography night, and no specialist
              camera is required to take part.
            </p>
          </div>
        </section>

        <section className="am-section am-faq" aria-labelledby="am-host-faq-title">
          <div className="am-section-head">
            <h2 id="am-host-faq-title">Common questions</h2>
          </div>
          <div className="am-faq-grid">
            {HOST_FAQS.map((faq) => (
              <details className="am-faq-item" key={faq.question}>
                <summary>
                  <span>{faq.question}</span>
                  <span className="am-faq-sign">＋</span>
                </summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="am-colophon">
        <div className="am-colophon-grid">
          <div className="am-colophon-brand">
            <div className="am-wordmark am-wordmark--small">ATLAS</div>
            <p>The short list of what is worth looking up for.</p>
            <Link to="/" className="am-btn am-btn-outline">
              Back to Atlas
            </Link>
          </div>
          <div className="am-colophon-col">
            <span>The app</span>
            <Link to="/#week">Highlights</Link>
            <Link to="/#nights">Sky nights</Link>
            <Link to="/#access">Sky Pass</Link>
          </div>
          <div className="am-colophon-col">
            <span>Hosts</span>
            <a href={`mailto:${HOST_CONTACT_EMAIL}`}>Discuss a sky night</a>
          </div>
        </div>
        <div className="am-colophon-legal">
          <span>© {new Date().getFullYear()} Atlas</span>
          <span>Star Sailors</span>
        </div>
      </footer>
    </div>
  )
}
