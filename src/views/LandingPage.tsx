import { useEffect, useState } from 'react'
import { trackEvent } from '../lib/analytics'
import { CITIES, type City } from '../lib/cities'
import '../mobile.css'

interface LandingPageProps {
  isMobile: boolean
  requestLocation: () => void
  setManualLocation: (city: City | null) => void
  onEnter: () => void
}

function normalizeLocation(value: string): string {
  return value.trim().toLocaleLowerCase()
}

function findCity(query: string): City | null {
  const normalized = normalizeLocation(query)
  if (!normalized) return null
  return (
    CITIES.find((city) => normalizeLocation(city.name) === normalized) ??
    CITIES.find((city) => normalizeLocation(city.name).startsWith(normalized)) ??
    CITIES.find((city) => normalizeLocation(city.name).includes(normalized)) ??
    null
  )
}

export function LandingPage({ isMobile, requestLocation, setManualLocation, onEnter }: LandingPageProps) {
  const [locationQuery, setLocationQuery] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    trackEvent('Viewed landing page', { isMobile })
    // Only ever track the initial view of this mount, not on every
    // isMobile flip (e.g. a window resize crossing the breakpoint).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function enterWithCity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const city = findCity(locationQuery)
    if (!city) {
      setError('Choose a nearby city from the list, or use your current location.')
      return
    }
    setManualLocation(city)
    trackEvent('Landing CTA clicked', { method: 'manual_city', city: city.name, isMobile })
    onEnter()
  }

  function enterWithBrowserLocation() {
    setManualLocation(null)
    requestLocation()
    trackEvent('Landing CTA clicked', { method: 'browser_geolocation', isMobile })
    onEnter()
  }

  const form = (
    <form className={isMobile ? 'dt-landing-form' : 'landing-form'} onSubmit={enterWithCity}>
      <label htmlFor="landing-location">Where are you watching from?</label>
      <div className={isMobile ? 'dt-landing-input-row' : 'landing-input-row'}>
        <input
          id="landing-location"
          type="text"
          value={locationQuery}
          onChange={(event) => {
            setLocationQuery(event.target.value)
            setError('')
          }}
          placeholder="Town or city"
          list="landing-city-options"
          autoComplete="address-level2"
        />
        <button type="submit" className={isMobile ? 'dt-landing-cta-primary' : 'landing-cta-primary'}>
          See tonight&apos;s sky
        </button>
      </div>
      <datalist id="landing-city-options">
        {CITIES.map((city) => (
          <option key={city.name} value={city.name} />
        ))}
      </datalist>
      <button type="button" className={isMobile ? 'dt-landing-location-button' : 'landing-location-button'} onClick={enterWithBrowserLocation}>
        Use my current location
      </button>
      {error && <p className={isMobile ? 'dt-landing-error' : 'landing-error'}>{error}</p>}
    </form>
  )

  if (isMobile) {
    return (
      <div className="dt-landing">
        <div className="dt-landing-hero">
          <img src="/atlas-icon.png" alt="" className="brand-mark brand-mark--landing" />
          <h1>What can I see in the sky tonight?</h1>
          <p>Enter your location and Atlas will show what is visible, when to go outside, and where to look.</p>
          {form}
        </div>
      </div>
    )
  }

  return (
    <div className="landing-page">
      <div className="landing-hero">
        <img src="/atlas-icon.png" alt="" className="brand-mark brand-mark--landing" />
        <h1>What can I see in the sky tonight?</h1>
        <p>Enter your location and Atlas will show what is visible, when to go outside, and where to look.</p>
        {form}
      </div>
    </div>
  )
}
