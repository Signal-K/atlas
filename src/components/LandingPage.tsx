import { Link } from 'react-router-dom'
import { Starfield } from './mobile/Starfield'

export function LandingPage() {
  return <div className="landing">
    <div className="landing-stars"><Starfield dark palette="mono" motion="static" density={110} /></div>
    <header className="landing-header"><Link className="landing-logo" to="/">Atlas<span>✦</span></Link><Link className="landing-header-link" to="/app/hub">Open Atlas <span aria-hidden="true">↗</span></Link></header>
    <main>
      <section className="landing-hero">
        <p className="landing-eyebrow">A LITTLE CLOSER TO THE COSMOS</p>
        <h1>Look up.<br /><em>There’s more to see.</em></h1>
        <p className="landing-intro">Find out what’s happening above you, plan a night under the stars, and keep track of what you discover.</p>
        <Link className="landing-cta" to="/app/hub">Explore your sky <span aria-hidden="true">↗</span></Link>
        <p className="landing-note">No account needed to get started.</p>
        <div className="landing-orbit" aria-hidden="true"><div className="landing-moon">✦</div><span className="orbit-label">YOUR SKY, TONIGHT</span></div>
      </section>
      <section className="landing-highlights" aria-labelledby="landing-highlights-title">
        <div className="landing-section-heading"><div><p className="landing-eyebrow">MADE FOR CURIOUS NIGHTS</p><h2 id="landing-highlights-title">A guide to the sky,<br /><em>wherever you are.</em></h2></div><p>From your first look at the Moon to your next observing session, Atlas helps you find your way.</p></div>
        <div className="landing-cards">
          <article><span className="landing-card-number">01 / DISCOVER</span><div className="landing-card-icon" aria-hidden="true">✳</div><h3>Know what’s up</h3><p>Explore a feed of sky events and viewing highlights for your location and equipment.</p></article>
          <article><span className="landing-card-number">02 / REMEMBER</span><div className="landing-card-icon" aria-hidden="true">◒</div><h3>Keep your observations</h3><p>Save the moments you want to see and record what you found in your journal.</p></article>
          <article><span className="landing-card-number">03 / LEARN</span><div className="landing-card-icon" aria-hidden="true">✧</div><h3>Grow at your own pace</h3><p>Build your observing skills and look back on the nights you’ve spent exploring.</p></article>
        </div>
      </section>
      <section className="landing-end"><p className="landing-eyebrow">THE SKY IS WAITING</p><h2>Make tonight a<br /><em>night to remember.</em></h2><Link className="landing-cta" to="/app/hub">Explore your sky <span aria-hidden="true">↗</span></Link></section>
    </main><footer className="landing-footer"><span>Atlas ✦</span><span>MADE FOR LOOKING UP</span></footer>
  </div>
}
