import { useEffect, useMemo, useState } from 'react'
import { trackEvent } from '../lib/analytics'
import { pullSkyEvents, getEventsInRange } from '../lib/sync'
import type { SkyEvent } from '../lib/db'
import { metaFor } from '../lib/tonightTargets'
import { FREE_FEATURES_SUMMARY, SKY_PASS_FEATURES_SUMMARY, SKY_PASS_TIERS } from '../lib/pricing'
import { fetchEvents as fetchConjunctionEvents } from '../lib/eventSources/conjunctions.mjs'
import { fetchEvents as fetchEclipseEvents } from '../lib/eventSources/eclipses.mjs'
import { fetchEvents as fetchMeteorShowerEvents } from '../lib/eventSources/meteor-showers.mjs'
import { fetchEvents as fetchPlanetEvents } from '../lib/eventSources/planets.mjs'

interface LandingPageProps { authenticatedEmail?: string; onEnter: () => void; onEnterPaid: () => void }
type CtaSource = 'nav' | 'hero' | 'forecast' | 'free' | 'footer'
interface Highlight { id: string; date: string; title: string; detail: string; gear: string }

function buildHighlights(events: SkyEvent[]): Highlight[] {
  const priority: Record<string, number> = { eclipse: 0, meteor_shower: 1, conjunction: 2, planet_event: 3, moon_phase: 4, bright_star: 5 }
  const seen = new Set<string>()
  return events.filter((event) => priority[event.kind] !== undefined)
    .sort((a, b) => (priority[a.kind] - priority[b.kind]) || a.startsAt.localeCompare(b.startsAt))
    .filter((event) => { const key = `${event.kind}:${event.target}`; if (seen.has(key)) return false; seen.add(key); return true })
    .slice(0, 3).map((event) => {
      const difficulty = metaFor(event.kind).difficulty
      return { id: event.id, date: new Date(event.startsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), title: event.title, detail: event.description || metaFor(event.kind).reason, gear: difficulty === 'easy' ? 'Naked eye' : difficulty === 'moderate' ? 'Binoculars' : 'Telescope' }
    })
}

export function LandingPage({ authenticatedEmail, onEnter, onEnterPaid }: LandingPageProps) {
  const [highlights, setHighlights] = useState<Highlight[] | null>(null)
  const weekLabel = useMemo(() => { const today = new Date(); const end = new Date(today.getTime() + 6 * 86_400_000); return `${today.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}–${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` }, [])

  useEffect(() => { trackEvent('Viewed landing page', { authenticated: Boolean(authenticatedEmail) }) }, [authenticatedEmail])
  useEffect(() => {
    let cancelled = false; const now = new Date()
    async function loadHighlights() {
      try {
        try { await pullSkyEvents() } catch (error) { trackEvent('sync_failed', { stage: 'landing_highlights_sync', error: String(error) }) }
        const end = new Date(now.getTime() + 30 * 86_400_000)
        const [cached, generated] = await Promise.all([getEventsInRange(now, end), Promise.allSettled([fetchConjunctionEvents({ now, windowDays: 30 }), fetchEclipseEvents({ now, windowDays: 30 }), fetchMeteorShowerEvents({ now, windowDays: 30 }), fetchPlanetEvents({ now, windowDays: 30 })])])
        const computed: SkyEvent[] = generated.flatMap((result) => result.status === 'fulfilled' ? result.value : []).map((event, index) => ({ id: `landing-${event.kind}-${event.target}-${event.starts_at}-${index}`, kind: event.kind, target: event.target, title: event.title, description: event.description, content: event.content, startsAt: event.starts_at, endsAt: event.ends_at ?? event.starts_at, updatedAt: now.toISOString() }))
        if (!cancelled) setHighlights(buildHighlights([...cached, ...computed]))
      } catch (error) { if (!cancelled) setHighlights([]); trackEvent('sync_failed', { stage: 'landing_highlights', error: String(error) }) }
    }
    void loadHighlights(); return () => { cancelled = true }
  }, [])
  function enter(source: CtaSource) { trackEvent('Landing CTA clicked', { method: authenticatedEmail ? 'open_app' : 'get_started', source }); onEnter() }

  return <div className="atlas-landing">
    <header className="landing-nav"><a className="landing-wordmark" href="#top" aria-label="Atlas home">ATLAS</a><nav aria-label="Primary"><a href="#how">How it works</a><a href="#pass">Sky Pass</a></nav><button className="landing-nav-cta" type="button" onClick={() => enter('nav')}>See my sky <span aria-hidden="true">↗</span></button></header>
    <main id="top">
      <section className="landing-hero" aria-labelledby="landing-title"><div className="landing-hero-copy"><p className="landing-eyebrow">A stargazing app</p><h1 id="landing-title">There is something worth going outside for.</h1><p className="landing-intro">See the next week’s sky from your city for free. Find something worth looking for, check the conditions, and step outside.</p><div className="landing-actions"><button className="landing-primary" type="button" onClick={() => enter('hero')}>See my sky <span aria-hidden="true">→</span></button><span>Free city forecast · Sky Pass is optional</span></div></div><div className="landing-sky" aria-hidden="true"><i className="landing-moon" /><i className="landing-star landing-star-a" /><i className="landing-star landing-star-b" /><i className="landing-star landing-star-c" /><svg viewBox="0 0 360 190" focusable="false"><path d="M8 151C81 106 106 118 161 82s110-38 191-76" /><circle cx="8" cy="151" r="3" /><circle cx="161" cy="82" r="3" /><circle cx="352" cy="6" r="3" /></svg><div className="landing-horizon" /></div></section>
      <section className="landing-proof" aria-labelledby="landing-proof-title"><div><p className="landing-eyebrow">Open the real forecast</p><h2 id="landing-proof-title">Your sky changes with your city.</h2><p>Atlas uses your location to show what is above you, when it is visible, and the conditions worth checking before you leave.</p><button className="landing-text-cta" type="button" onClick={() => enter('forecast')}>Choose my city <span aria-hidden="true">→</span></button></div><aside className="landing-forecast-card" aria-label="Atlas forecast preview"><div className="landing-card-top"><span>Atlas forecast</span><strong>{weekLabel}</strong></div><div className="landing-card-location"><span className="landing-pin" aria-hidden="true">✦</span><div><strong>Your city</strong><span>Set your location in Atlas</span></div></div><div className="landing-card-status"><span>Visibility and weather appear after you choose a city.</span><span aria-hidden="true">↗</span></div></aside></section>
      <section id="how" className="landing-section" aria-labelledby="landing-how-title"><p className="landing-eyebrow">A reason to look up</p><h2 id="landing-how-title">Make the night feel possible.</h2><div className="landing-steps"><article><span>01</span><h3>Find something worth seeing</h3><p>Start with the objects and astronomical events that are relevant to your sky.</p></article><article><span>02</span><h3>Check when and whether</h3><p>See the time, direction and conditions before you make a plan. A forecast is a guide, not a guarantee.</p></article><article><span>03</span><h3>Head outside</h3><p>Take a few minutes with your own eyes, binoculars or telescope—whatever the night calls for.</p></article></div></section>
      <section className="landing-section landing-highlights" aria-labelledby="landing-highlights-title"><div className="landing-section-heading"><div><p className="landing-eyebrow">From the sky catalogue</p><h2 id="landing-highlights-title">Worth keeping an eye on.</h2></div><button className="landing-text-cta" type="button" onClick={() => enter('forecast')}>See my city’s forecast <span aria-hidden="true">→</span></button></div><div className="landing-highlight-grid">{highlights === null ? <p className="landing-loading">Checking the next month’s sky…</p> : highlights.length === 0 ? <p className="landing-loading">Atlas will show the next astronomical highlight in your forecast.</p> : highlights.map((highlight) => <article key={highlight.id}><span>{highlight.date}</span><h3>{highlight.title}</h3><p>{highlight.detail}</p><small>{highlight.gear}</small></article>)}</div></section>
      <section id="pass" className="landing-pass" aria-labelledby="landing-pass-title"><div><p className="landing-eyebrow">Your pace, your choice</p><h2 id="landing-pass-title">Start free. Go further if you want.</h2><p>Atlas is useful before you pay. Sky Pass is for people who want more time to plan and more ways to take the sky with them.</p></div><div className="landing-plan-grid"><article><div><span>Free</span><small>No account needed to preview</small></div><p>{FREE_FEATURES_SUMMARY}</p><button className="landing-secondary" type="button" onClick={() => enter('free')}>See my sky <span aria-hidden="true">→</span></button></article><article className="landing-plan-pass"><div><span>Sky Pass</span><small>Optional upgrade</small></div><ul>{SKY_PASS_TIERS.map((tier) => <li key={tier.id}><span>{tier.label}</span><strong>{tier.price}</strong></li>)}</ul><p>{SKY_PASS_FEATURES_SUMMARY}</p><button className="landing-secondary" type="button" onClick={onEnterPaid}>Explore Sky Pass <span aria-hidden="true">→</span></button></article></div></section>
    </main>
    <footer className="landing-footer"><div><a className="landing-wordmark" href="#top">ATLAS</a><p>A stargazing app for finding a reason to step outside.</p></div><div><a href="#how">How it works</a><a href="#pass">Sky Pass</a><button type="button" onClick={() => enter('footer')}>See my sky</button></div><small>© {new Date().getFullYear()} Atlas</small></footer>
  </div>
}
