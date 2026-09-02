import { useEffect, useMemo, useState } from 'react'
import { Sheet } from './Sheet'
import { MobileIcon } from './MobileIcon'
import { cityLabel, type City } from '../../lib/cities'
import { MAKER_LABELS, MAKER_ORDER, modelsForMaker, type DeviceId, deviceIdFromPreset } from '../../lib/cameraProfiles'
import { InterestsPicker } from '../InterestsPicker'
import { LocationSearchInput } from '../LocationSearchInput'
import { getPreferredEventTypes } from '../../lib/eventPreferences'
import { TRIP_MAX_LEGS, VIEWING_INSTRUMENTS, makeLeg, saveTripPlan, type TripLeg, type TripPlan } from '../../lib/tripPlans'
import { trackEvent } from '../../lib/analytics'
import { useAuth } from '../../lib/auth'

type Step = 'itinerary' | 'details' | 'review'
const STEPS: Step[] = ['itinerary', 'details', 'review']
const STEP_KICKER: Record<Step, string> = {
  itinerary: 'STEP 1 OF 3 · ITINERARY',
  details: 'STEP 2 OF 3 · GEAR',
  review: 'STEP 3 OF 3 · REVIEW',
}
const STEP_TITLE: Record<Step, string> = {
  itinerary: 'Where are you going?',
  details: 'Personalize your guides',
  review: 'Ready to go?',
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatDayLabel(iso: string): string {
  if (!iso) return ''
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function deriveTripDates(legs: TripLeg[]): { startDate: string; endDate: string } {
  if (legs.length === 0) return { startDate: '', endDate: '' }
  const starts = legs.map((leg) => leg.startDate).sort((a, b) => a.localeCompare(b))
  const ends = legs.map((leg) => leg.endDate).sort((a, b) => a.localeCompare(b))
  return { startDate: starts[0], endDate: ends[ends.length - 1] }
}

// Non-blocking sanity check: pairs of stays whose nights overlap.
function tripLegIssues(legs: TripLeg[]): string[] {
  const issues: string[] = []
  const ordered = [...legs].sort((a, b) => a.startDate.localeCompare(b.startDate))
  for (let i = 1; i < ordered.length; i++) {
    if (ordered[i].startDate <= ordered[i - 1].endDate) {
      issues.push(`${ordered[i - 1].cityName} and ${ordered[i].cityName} overlap on the same nights.`)
    }
  }
  return issues
}

// Bottom-sheet itinerary builder, matching the Atlas Mobile mockup's
// sheetBuilder step flow -- ports PlanTripView's real 3-step trip builder
// (itinerary -> gear/interests -> review) into a Sheet instead of an inline
// page section.
export function ItineraryBuilderSheet({
  open,
  onClose,
  onSaved,
  existingTrip,
}: {
  open: boolean
  onClose: () => void
  onSaved: (trip: TripPlan) => void
  existingTrip: TripPlan | null
}) {
  const { user } = useAuth()
  const [stepIndex, setStepIndex] = useState(0)
  const [legs, setLegs] = useState<TripLeg[]>(existingTrip?.legs ?? [])
  const [cityQuery, setCityQuery] = useState('')
  const [selectedCity, setSelectedCity] = useState<City | null>(null)
  const [legStart, setLegStart] = useState('')
  const [legEnd, setLegEnd] = useState('')
  const [equipment, setEquipment] = useState<string[]>(existingTrip?.equipment ?? [])
  const [interests, setInterests] = useState<string[]>(existingTrip?.interests ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setLegs(existingTrip?.legs ?? [])
      setEquipment(existingTrip?.equipment ?? [])
      setInterests(existingTrip?.interests ?? [])
      setStepIndex(0)
      setError('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (open && interests.length === 0 && !existingTrip) {
      getPreferredEventTypes().then((kinds) => {
        if (kinds.length > 0) setInterests(kinds)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (open && equipment.length === 0 && !existingTrip && user?.deviceModels) {
      const ids = user.deviceModels.map(deviceIdFromPreset).filter((id): id is DeviceId => id !== null)
      if (ids.length > 0) setEquipment(ids)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.deviceModels])

  const { startDate, endDate } = useMemo(() => deriveTripDates(legs), [legs])
  const legIssues = useMemo(() => tripLegIssues(legs), [legs])
  const step = STEPS[stepIndex]
  const atMax = legs.length >= TRIP_MAX_LEGS
  const canContinue = step === 'itinerary' ? legs.length > 0 : true

  function addLeg() {
    if (!selectedCity || !legStart || !legEnd || legEnd < legStart || atMax) return
    setLegs((current) => [...current, makeLeg(selectedCity, legStart, legEnd)])
    setCityQuery('')
    setSelectedCity(null)
    setLegStart('')
    setLegEnd('')
  }

  function selectCity(city: City) {
    setSelectedCity(city)
    setCityQuery(cityLabel(city))
    if (!legStart) {
      const defaultStart = legs.length > 0 ? legs[legs.length - 1].endDate : todayKey()
      setLegStart(defaultStart)
      if (!legEnd) setLegEnd(defaultStart)
    }
  }

  function toggleEquipment(id: string) {
    setEquipment((current) => (current.includes(id) ? current.filter((v) => v !== id) : [...current, id]))
  }

  function toggleInterest(kinds: string[]) {
    setInterests((current) => {
      const active = kinds.every((kind) => current.includes(kind))
      return active ? current.filter((kind) => !kinds.includes(kind)) : [...new Set([...current, ...kinds])]
    })
  }

  async function handleSave() {
    if (legs.length === 0) return
    setSaving(true)
    setError('')
    try {
      const trip = await saveTripPlan({ startDate, endDate, legs, equipment, interests })
      trackEvent('Saved trip plan', { legs: legs.length, equipment: equipment.length, interests: interests.length })
      onSaved(trip)
      onClose()
    } catch {
      setError('Could not save your trip. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function advance() {
    setError('')
    if (stepIndex + 1 >= STEPS.length) handleSave()
    else setStepIndex(stepIndex + 1)
  }

  return (
    <Sheet open={open} title="Build an itinerary" onClose={onClose}>
      <div className="az-onboard-bars">
        {STEPS.map((s, i) => (
          <span key={s} className={`az-onboard-bar${i <= stepIndex ? ' is-done' : ''}`} />
        ))}
      </div>
      <p className="az-kicker" style={{ margin: '0.75rem 0 0' }}>
        {STEP_KICKER[step]}
      </p>
      <h3 style={{ margin: '0.375rem 0 0.25rem', fontFamily: 'var(--az-font-display)', fontSize: '1.3125rem' }}>{STEP_TITLE[step]}</h3>

      {step === 'itinerary' && (
        <>
          <p className="az-muted" style={{ fontSize: '0.8125rem' }}>
            Add each place you'll stay and the nights you'll be there. Atlas builds a sky guide for every stop.
          </p>
          {legs.length > 0 && (
            <div className="az-row-group" style={{ marginBottom: '0.75rem' }}>
              {legs.map((leg) => (
                <div key={`${leg.cityKey}-${leg.startDate}`} className="az-row" style={{ cursor: 'default' }}>
                  <span className="az-row-icon">
                    <MobileIcon name="pin" size={15} />
                  </span>
                  <span className="az-row-main">
                    <span className="az-row-title">{leg.cityName}</span>
                    <span className="az-muted" style={{ fontSize: '0.75rem' }}>
                      {formatDayLabel(leg.startDate)} – {formatDayLabel(leg.endDate)}
                    </span>
                  </span>
                  <button type="button" className="az-icon-btn" aria-label={`Remove ${leg.cityName}`} onClick={() => setLegs((c) => c.filter((l) => l !== leg))}>
                    <MobileIcon name="close" size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {legIssues.length > 0 && (
            <p style={{ color: 'var(--az-flagship)', fontSize: '0.78125rem' }}>{legIssues.join(' ')}</p>
          )}
          {atMax ? (
            <p className="az-muted" style={{ fontSize: '0.8125rem' }}>You've reached the maximum of {TRIP_MAX_LEGS} stops.</p>
          ) : (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <LocationSearchInput id="planner-city-search" value={cityQuery} onChange={(q) => { setCityQuery(q); setSelectedCity(null) }} onSelect={selectCity} placeholder="Search any town or city" />
              {selectedCity && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.75rem' }}>
                      From
                      <input type="date" className="az-input" value={legStart} onChange={(e) => setLegStart(e.target.value)} />
                    </label>
                    <label style={{ fontSize: '0.75rem' }}>
                      To
                      <input type="date" className="az-input" value={legEnd} min={legStart || undefined} onChange={(e) => setLegEnd(e.target.value)} />
                    </label>
                  </div>
                  <button type="button" className="az-btn az-btn-primary az-btn-block" onClick={addLeg} disabled={!legStart || !legEnd || legEnd < legStart}>
                    Add {cityLabel(selectedCity)} to trip
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}

      {step === 'details' && (
        <>
          <p className="az-muted" style={{ fontSize: '0.8125rem' }}>
            Optional -- tell Atlas what you're bringing and what you're into, and it tailors each city's guide.
          </p>
          <p className="az-kicker" style={{ margin: '0.875rem 0 0.5rem' }}>Gear</p>
          <div className="az-chip-row" style={{ flexWrap: 'wrap' }}>
            {VIEWING_INSTRUMENTS.map((opt) => (
              <button type="button" key={opt.id} className={`az-chip${equipment.includes(opt.id) ? ' is-active' : ''}`} onClick={() => toggleEquipment(opt.id)}>
                {opt.label}
              </button>
            ))}
          </div>
          <div className="az-chip-row" style={{ flexWrap: 'wrap', marginTop: '0.5rem' }}>
            {MAKER_ORDER.flatMap((maker) =>
              modelsForMaker(maker).map((profile) => (
                <button type="button" key={profile.id} className={`az-chip${equipment.includes(profile.id) ? ' is-active' : ''}`} onClick={() => toggleEquipment(profile.id)}>
                  {MAKER_LABELS[maker]} {profile.name}
                </button>
              )),
            )}
          </div>
          <p className="az-kicker" style={{ margin: '0.875rem 0 0.5rem' }}>Interests</p>
          <InterestsPicker selected={interests} onToggleCategory={toggleInterest} />
        </>
      )}

      {step === 'review' && (
        <>
          <p className="az-muted" style={{ fontSize: '0.8125rem' }}>
            {formatDayLabel(startDate)} – {formatDayLabel(endDate)} · {legs.length} {legs.length === 1 ? 'stop' : 'stops'}
          </p>
          <div className="az-row-group">
            {legs.map((leg) => (
              <div key={leg.cityKey} className="az-row" style={{ cursor: 'default' }}>
                <span className="az-row-main">
                  <span className="az-row-title">{leg.cityName}</span>
                  <span className="az-muted" style={{ fontSize: '0.75rem' }}>{formatDayLabel(leg.startDate)} – {formatDayLabel(leg.endDate)}</span>
                </span>
              </div>
            ))}
          </div>
          <p className="az-muted" style={{ fontSize: '0.75rem', marginTop: '0.75rem' }}>
            {equipment.length} gear item{equipment.length === 1 ? '' : 's'} · {interests.length} interest{interests.length === 1 ? '' : 's'} selected
          </p>
        </>
      )}

      {error && <p style={{ color: 'var(--az-flagship)', fontSize: '0.8125rem' }}>{error}</p>}

      <div className="az-btn-row" style={{ marginTop: '1rem' }}>
        {stepIndex > 0 && (
          <button type="button" className="az-btn az-btn-outline" onClick={() => setStepIndex((i) => i - 1)}>
            Back
          </button>
        )}
        <button type="button" className="az-btn az-btn-primary" style={{ flex: 1 }} disabled={!canContinue || saving} onClick={advance}>
          {saving ? 'Saving…' : step === 'review' ? 'Save itinerary' : 'Next'}
        </button>
      </div>
    </Sheet>
  )
}
