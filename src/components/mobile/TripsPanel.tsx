import { useState } from 'react'
import { cityLabel, type City } from '../../lib/cities'
import { addTrip, listTrips, removeTrip, type Trip } from '../../lib/trips'
import { LocationSearchInput } from '../LocationSearchInput'
import { trackEvent } from '../../lib/analytics'
import { BackIcon, MobileIcon } from './MobileIcon'

function todayKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function formatRange(trip: Trip): string {
  const start = new Date(`${trip.startDate}T00:00:00`)
  const end = new Date(`${trip.endDate}T00:00:00`)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`
}

// Summary for the Plan page's tool card, before the panel is opened.
export function tripsSummary() {
  const trips = listTrips()
  const active = trips.find((trip) => trip.startDate <= todayKey() && todayKey() <= trip.endDate)
  return { count: trips.length, active }
}

export function TripsPanel({ onBack }: { onBack: () => void }) {
  const [trips, setTrips] = useState<Trip[]>(() => listTrips())
  const [city, setCity] = useState<City | null>(null)
  const [locationQuery, setLocationQuery] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState('')

  function refresh() {
    setTrips(listTrips())
  }

  function submit() {
    if (!city) {
      setError('Pick a place from the search results first.')
      return
    }
    if (!startDate || !endDate || endDate < startDate) {
      setError('Pick a valid start and end date.')
      return
    }
    addTrip({ city, startDate, endDate })
    trackEvent('Added trip', { city: city.name, country: city.country })
    setCity(null)
    setLocationQuery('')
    setStartDate('')
    setEndDate('')
    setError('')
    refresh()
  }

  return (
    <div className="mobile-plan">
      <section className="mobile-card">
        <button type="button" className="mobile-back mobile-plan-detail-back" onClick={onBack} aria-label="Back to plan">
          <BackIcon />
        </button>
        <div className="mobile-card-eyebrow mobile-card-eyebrow--icon">
          <MobileIcon name="plane" /> Trips
        </div>
        <p className="mobile-empty-hint">
          Tell Atlas where you'll be and when. While a trip is active, the feed, tonight's conditions, and reminders
          switch to that location automatically.
        </p>

        {trips.length > 0 && (
          <div className="mobile-tool-list">
            {trips.map((trip) => {
              const active = trip.startDate <= todayKey() && todayKey() <= trip.endDate
              return (
                <div className={`mobile-tool-row${active ? ' mobile-tool-row--active' : ''}`} key={trip.id}>
                  <div className="mobile-tool-row-head">
                    <strong>
                      {trip.name}
                      {active && <span className="mobile-trip-active-badge">On location</span>}
                    </strong>
                    <span>{formatRange(trip)}</span>
                  </div>
                  <div className="mobile-tool-row-foot">
                    <button
                      type="button"
                      className="mobile-text-button"
                      onClick={() => {
                        removeTrip(trip.id)
                        refresh()
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="mobile-plan-trip-form">
          <LocationSearchInput
            id="trip-location"
            value={locationQuery}
            onChange={setLocationQuery}
            onSelect={(selected) => {
              setCity(selected)
              setLocationQuery(cityLabel(selected))
            }}
            placeholder="Where are you going?"
          />
          <div className="mobile-plan-trip-dates">
            <label>
              From
              <input type="date" value={startDate} min={todayKey()} onChange={(event) => setStartDate(event.target.value)} />
            </label>
            <label>
              To
              <input type="date" value={endDate} min={startDate || todayKey()} onChange={(event) => setEndDate(event.target.value)} />
            </label>
          </div>
          {error && <p className="mobile-empty-hint">{error}</p>}
          <button type="button" className="mobile-primary-button" onClick={submit}>
            Add trip
          </button>
        </div>
      </section>
    </div>
  )
}
