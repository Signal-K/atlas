import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppLocation } from '../providers/useAppLocation'
import { useAuth } from '../lib/auth'
import { setWorkspaceValue } from '../lib/workspaceSync'
import { CITIES } from '../lib/cities'
import type { Equipment } from '../lib/feedEquipment'
import { DailyFocus } from './DailyFocus'
import { FeedBriefing } from './FeedBriefing'
import { LocationPicker } from './LocationPicker'

export function LandingPage() {
  const { currentLocation, setManualLocation } = useAppLocation()
  const { user } = useAuth()
  const [editingLocation, setEditingLocation] = useState(false)
  const [equipment, setEquipment] = useState<Equipment>('eye')
  const example = CITIES.find(city => city.name === 'Melbourne')!
  const city = currentLocation.source === 'default'
    ? { ...example, name: 'Melbourne', source: 'default' as const }
    : currentLocation

  return <div className="landing">
    <header className="landing-header">
      <Link className="landing-logo" to="/">Atlas<span aria-hidden="true">·</span></Link>
      <nav aria-label="Landing navigation"><a href="#sky-preview">Tonight’s sky</a><Link className="landing-open" to="/app/hub">Open Atlas <span aria-hidden="true">→</span></Link></nav>
    </header>
    <main>
      <section className="landing-intro">
        <p className="landing-kicker">ATLAS / YOUR NIGHT SKY</p>
        <h1>See what’s up tonight.</h1>
        <p>Plan an observing night, find things to look for, and keep a record of what you see.</p>
        <Link className="landing-primary" to="/app/hub">Open your sky <span aria-hidden="true">→</span></Link>
        <span className="landing-free">Free to explore · No account required</span>
      </section>
      <section className="landing-preview" id="sky-preview" aria-labelledby="preview-title">
        <div className="landing-preview-top"><div><p className="landing-kicker">LIVE SKY PREVIEW</p><h2 id="preview-title">A look at tonight</h2><p>Forecasts and observing ideas for your location.</p></div><span className="landing-live"><i /> Live preview</span></div>
        <div className="landing-toolbar"><div><span className="landing-control-label">Location</span><button type="button" className="landing-location" aria-expanded={editingLocation} onClick={() => setEditingLocation(value => !value)}>{city.name}{currentLocation.source === 'default' ? ' · example' : ''} <span aria-hidden="true">⌄</span></button></div><div><span className="landing-control-label">Equipment</span><div className="landing-equipment" role="group" aria-label="Viewing equipment">{(['eye', 'binoculars', 'telescope'] as const).map(value => <button key={value} type="button" aria-pressed={equipment === value} onClick={() => setEquipment(value)}>{value === 'eye' ? 'Naked eye' : value === 'binoculars' ? 'Binoculars' : 'Telescope'}</button>)}</div></div></div>
        {editingLocation && <div className="landing-location-panel"><LocationPicker onSelect={place => { setManualLocation(place); setWorkspaceValue(user?.id ?? 'local', 'preference:location', place); setEditingLocation(false) }} /></div>}
        <div className="landing-live-content"><DailyFocus city={city} equipment={equipment} /><FeedBriefing city={city} equipment={equipment} catalogueKey="" /></div>
      </section>
      <section className="landing-more"><div><p className="landing-kicker">MORE IN ATLAS</p><h2>Make the most of a clear night.</h2></div><div className="landing-feature-list"><Link to="/app/hub"><span>01</span><strong>Sky events</strong><small>Find what’s coming up</small><b>→</b></Link><Link to="/app/journal"><span>02</span><strong>Journal</strong><small>Record your observations</small><b>→</b></Link><Link to="/app/skills"><span>03</span><strong>Skills</strong><small>Learn as you observe</small><b>→</b></Link></div></section>
    </main>
    <footer className="landing-footer"><span>Atlas</span><Link to="/app/hub">Open Atlas →</Link></footer>
  </div>
}
