import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/auth'
import { PaywallGate } from '../components/PaywallGate'
import { CITIES, cityLabel, type City } from '../lib/cities'
import { EVENT_CATEGORIES } from '../lib/eventCategories'
import { MAKER_LABELS, MAKER_ORDER, modelsForMaker, type DeviceMaker } from '../lib/cameraProfiles'
import {
  TRIP_MAX_LEGS,
  VIEWING_INSTRUMENTS,
  activeLegFor,
  deleteTripPlan,
  getActiveTripPlan,
  makeLeg,
  saveTripLegGuide,
  saveTripPlan,
  type TripLeg,
  type TripPlan,
} from '../lib/tripPlans'
import { requestTripLegGuide } from '../lib/tripGuide'
import { trackEvent } from '../lib/analytics'

const MILKY_WAY_LABEL: Record<'yes' | 'marginal' | 'no', string> = {
  yes: 'Milky Way visible',
  marginal: 'Milky Way marginal',
  no: 'Milky Way washed out',
}

export function PlanTripView() {
  const { user, entitlementRefreshing } = useAuth()

  return (
    <PaywallGate
      user={user}
      entitlementRefreshing={entitlementRefreshing}
      feature="Trip planning"
      description="Plan a trip across multiple cities, tell Atlas what gear you're bringing and what you're into, and get a personalized per-city sky guide -- including whether you'll catch the Milky Way."
      freeBullets="Tonight, 14-day event browsing, check-ins, and your private journal."
      paidBullets="Multi-city trip planning with AI-personalized per-city guides."
      onSignInClick={() => {
        window.location.href = '/app/settings'
      }}
    >
      <PlanTripWorkspace />
    </PaywallGate>
  )
}

function PlanTripWorkspace() {
  const [trip, setTrip] = useState<TripPlan | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getActiveTripPlan().then((active) => {
      setTrip(active)
      setLoading(false)
    })
  }, [])

  if (loading) return <p>Loading your trip…</p>

  if (!trip) return <TripBuilder onSaved={setTrip} />

  return <TripSummary trip={trip} onChanged={setTrip} onDeleted={() => setTrip(null)} />
}

function TripBuilder({ onSaved }: { onSaved: (trip: TripPlan) => void }) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [legs, setLegs] = useState<TripLeg[]>([])
  const [cityQuery, setCityQuery] = useState('')
  const [legStart, setLegStart] = useState('')
  const [legEnd, setLegEnd] = useState('')
  const [equipment, setEquipment] = useState<string[]>([])
  const [interests, setInterests] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const cityResults = useMemo(
    () => (cityQuery.trim() ? CITIES.filter((c) => cityLabel(c).toLowerCase().includes(cityQuery.trim().toLowerCase())).slice(0, 8) : []),
    [cityQuery],
  )

  function addLeg(city: City) {
    if (!legStart || !legEnd || legs.length >= TRIP_MAX_LEGS) return
    setLegs((current) => [...current, makeLeg(city, legStart, legEnd)])
    setCityQuery('')
    setLegStart('')
    setLegEnd('')
  }

  function removeLeg(index: number) {
    setLegs((current) => current.filter((_, i) => i !== index))
  }

  function toggleEquipment(id: string) {
    setEquipment((current) => (current.includes(id) ? current.filter((v) => v !== id) : [...current, id]))
  }

  function toggleInterest(id: string) {
    setInterests((current) => (current.includes(id) ? current.filter((v) => v !== id) : [...current, id]))
  }

  const canSave = startDate && endDate && legs.length > 0 && equipment.length > 0

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setError('')
    try {
      const trip = await saveTripPlan({ startDate, endDate, legs, equipment, interests })
      trackEvent('Saved trip plan', { legs: legs.length, equipment: equipment.length, interests: interests.length })
      onSaved(trip)
    } catch {
      setError('Could not save your trip. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="widget-section trip-builder">
      <h2>Plan a trip</h2>
      <p className="trip-hint">One trip at a time -- add every city you'll visit, then generate a guide per city.</p>

      <div className="trip-builder-step">
        <span className="camera-flow-label">1. Trip dates</span>
        <div className="trip-date-row">
          <label>
            Start
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label>
            End
            <input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="trip-builder-step">
        <span className="camera-flow-label">2. Cities ({legs.length}/{TRIP_MAX_LEGS})</span>
        {legs.length > 0 && (
          <ul className="row-list trip-leg-list">
            {legs.map((leg, index) => (
              <li key={`${leg.cityKey}-${leg.startDate}`} className="trip-leg-row">
                <span>
                  <strong>{leg.cityName}</strong> · {leg.startDate} to {leg.endDate}
                </span>
                <button type="button" onClick={() => removeLeg(index)} aria-label={`Remove ${leg.cityName}`}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        {legs.length < TRIP_MAX_LEGS && (
          <div className="trip-add-leg">
            <input type="search" placeholder="Search a city" value={cityQuery} onChange={(e) => setCityQuery(e.target.value)} />
            <div className="trip-date-row">
              <label>
                From
                <input type="date" value={legStart} min={startDate || undefined} max={endDate || undefined} onChange={(e) => setLegStart(e.target.value)} />
              </label>
              <label>
                To
                <input type="date" value={legEnd} min={legStart || startDate || undefined} max={endDate || undefined} onChange={(e) => setLegEnd(e.target.value)} />
              </label>
            </div>
            {cityQuery.trim() && (
              <div className="trip-city-results" role="listbox" aria-label="City results">
                {cityResults.map((city) => (
                  <button type="button" key={cityLabel(city)} onClick={() => addLeg(city)} disabled={!legStart || !legEnd}>
                    {cityLabel(city)}
                  </button>
                ))}
                {cityResults.length === 0 && <p>No matching cities.</p>}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="trip-builder-step">
        <span className="camera-flow-label">3. Equipment</span>
        <div className="filter-tabs">
          {VIEWING_INSTRUMENTS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={equipment.includes(option.id) ? 'is-active' : ''}
              onClick={() => toggleEquipment(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <PhonePicker selected={equipment} onToggle={toggleEquipment} />
      </div>

      <div className="trip-builder-step">
        <span className="camera-flow-label">4. Interests</span>
        <div className="filter-tabs">
          {EVENT_CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              className={interests.includes(category.id) ? 'is-active' : ''}
              onClick={() => toggleInterest(category.id)}
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="account-form-error">{error}</p>}
      <button type="button" className="scrapbook-submit" disabled={!canSave || saving} onClick={handleSave}>
        {saving ? 'Saving…' : 'Save trip'}
      </button>
    </section>
  )
}

function PhonePicker({ selected, onToggle }: { selected: string[]; onToggle: (id: string) => void }) {
  const [maker, setMaker] = useState<DeviceMaker>('apple')

  return (
    <div className="trip-phone-picker">
      <div className="filter-tabs camera-maker-tabs">
        {MAKER_ORDER.map((id) => (
          <button key={id} type="button" className={maker === id ? 'is-active' : ''} onClick={() => setMaker(id)}>
            {MAKER_LABELS[id]}
          </button>
        ))}
      </div>
      <div className="filter-tabs">
        {modelsForMaker(maker).map((profile) => (
          <button
            key={profile.id}
            type="button"
            className={selected.includes(profile.id) ? 'is-active' : ''}
            onClick={() => onToggle(profile.id)}
          >
            {profile.name}
          </button>
        ))}
      </div>
    </div>
  )
}

function TripSummary({ trip, onChanged, onDeleted }: { trip: TripPlan; onChanged: (trip: TripPlan) => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false)
  const today = new Date()
  const activeLeg = activeLegFor(trip, today)

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteTripPlan(trip.id)
      trackEvent('Deleted trip plan', {})
      onDeleted()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="widget-section trip-summary">
      <div className="trip-summary-header">
        <div>
          <h2>Your trip</h2>
          <p className="trip-hint">
            {trip.startDate} to {trip.endDate} · {trip.legs.length} {trip.legs.length === 1 ? 'city' : 'cities'}
          </p>
        </div>
        <button type="button" className="scrapbook-share-card" onClick={handleDelete} disabled={deleting}>
          {deleting ? 'Removing…' : 'End trip'}
        </button>
      </div>

      <ul className="row-list trip-leg-list">
        {trip.legs.map((leg) => (
          <TripLegCard key={leg.cityKey} trip={trip} leg={leg} isActive={activeLeg?.cityKey === leg.cityKey} onGuideSaved={onChanged} />
        ))}
      </ul>
    </section>
  )
}

function TripLegCard({
  trip,
  leg,
  isActive,
  onGuideSaved,
}: {
  trip: TripPlan
  leg: TripLeg
  isActive: boolean
  onGuideSaved: (trip: TripPlan) => void
}) {
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const guide = trip.guides[leg.cityKey]

  async function handleGenerate() {
    setGenerating(true)
    setError('')
    try {
      const generated = await requestTripLegGuide(leg, trip.equipment, trip.interests)
      const updated = await saveTripLegGuide(trip, leg.cityKey, generated)
      trackEvent('Generated trip guide', { city: leg.cityName })
      onGuideSaved(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate a guide for this city.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <li className={`trip-leg-card${isActive ? ' is-active-leg' : ''}`}>
      <div className="trip-leg-card-header">
        <strong>{leg.cityName}</strong>
        <span className="row-meta">{leg.startDate} to {leg.endDate}</span>
      </div>

      {guide ? (
        <div className="trip-leg-guide">
          <div className="trip-leg-guide-facts">
            <span>Bortle {guide.bortleClass} · {guide.skyQualityLabel}</span>
            <span>{Math.round(guide.moonIlluminationPct)}% moon</span>
            <span className={`trip-milky-way trip-milky-way--${guide.milkyWayVisible}`}>{MILKY_WAY_LABEL[guide.milkyWayVisible]}</span>
          </div>
          <p className="trip-leg-narrative">{guide.narrative}</p>
          <button type="button" className="scrapbook-share-card" onClick={handleGenerate} disabled={generating}>
            {generating ? 'Regenerating…' : 'Regenerate guide'}
          </button>
        </div>
      ) : (
        <button type="button" className="scrapbook-share-card" onClick={handleGenerate} disabled={generating}>
          {generating ? 'Generating…' : 'Generate guide'}
        </button>
      )}
      {error && <p className="account-form-error">{error}</p>}
    </li>
  )
}
