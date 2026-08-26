import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../lib/auth'
import { PaywallGate } from '../components/PaywallGate'
import { cityLabel, type City } from '../lib/cities'
import { MAKER_LABELS, MAKER_ORDER, modelsForMaker, type DeviceId, CAMERA_PROFILES, deviceIdFromPreset } from '../lib/cameraProfiles'
import { InterestsPicker } from '../components/InterestsPicker'
import { LocationSearchInput } from '../components/LocationSearchInput'
import { getPreferredEventTypes } from '../lib/eventPreferences'
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

type TripBuilderStep = 'dates' | 'cities' | 'equipment' | 'interests' | 'review'
const TRIP_BUILDER_STEPS: TripBuilderStep[] = ['dates', 'cities', 'equipment', 'interests', 'review']
const TRIP_BUILDER_STEP_LABELS: Record<TripBuilderStep, string> = {
  dates: 'Dates',
  cities: 'Cities',
  equipment: 'Gear',
  interests: 'Interests',
  review: 'Review',
}

// Non-blocking sanity checks on the itinerary: legs that fall outside the
// trip's own date window, and pairs of legs whose stays overlap (you can't
// be in two cities the same night). Gaps between legs are intentionally not
// flagged -- travel/rest days are normal -- but overlaps and out-of-range
// legs are almost always a mistake worth surfacing before the guide runs.
function tripLegIssues(legs: TripLeg[], startDate: string, endDate: string): string[] {
  const issues: string[] = []
  for (const leg of legs) {
    if ((startDate && leg.startDate < startDate) || (endDate && leg.endDate > endDate)) {
      issues.push(`${leg.cityName} falls outside your trip dates.`)
    }
  }
  const ordered = [...legs].sort((a, b) => a.startDate.localeCompare(b.startDate))
  for (let i = 1; i < ordered.length; i++) {
    if (ordered[i].startDate <= ordered[i - 1].endDate) {
      issues.push(`${ordered[i - 1].cityName} and ${ordered[i].cityName} overlap on the same nights.`)
    }
  }
  return issues
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
  const { user } = useAuth()
  const [trip, setTrip] = useState<TripPlan | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getActiveTripPlan().then((active) => {
      setTrip(active)
      setLoading(false)
    })
  }, [])

  if (loading) return <p>Loading your trip…</p>

  if (!trip) return <TripBuilder onSaved={setTrip} user={user} />

  return <TripSummary trip={trip} onChanged={setTrip} onDeleted={() => setTrip(null)} />
}

function TripBuilder({ onSaved, user }: { onSaved: (trip: TripPlan) => void; user: ReturnType<typeof useAuth>['user'] }) {
  const [stepIndex, setStepIndex] = useState(0)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [legs, setLegs] = useState<TripLeg[]>([])
  const [cityQuery, setCityQuery] = useState('')
  const [selectedCity, setSelectedCity] = useState<City | null>(null)
  const [legStart, setLegStart] = useState('')
  const [legEnd, setLegEnd] = useState('')
  const [equipment, setEquipment] = useState<string[]>([])
  const [interests, setInterests] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Default interests from user preferences on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (interests.length === 0) {
      getPreferredEventTypes().then((kinds) => {
        if (kinds.length > 0) setInterests(kinds)
      })
    }
  }, [])

  // Default equipment from user's device selections on mount
  useEffect(() => {
    if (equipment.length === 0 && user?.deviceModels) {
      const deviceIds = user.deviceModels
        .map(deviceIdFromPreset)
        .filter((id) => id !== null)
        .map((id) => id as DeviceId)
      if (deviceIds.length > 0) setEquipment(deviceIds)
    }
  }, [user?.deviceModels])

  const legIssues = useMemo(() => tripLegIssues(legs, startDate, endDate), [legs, startDate, endDate])

  const step = TRIP_BUILDER_STEPS[stepIndex]

  function addLeg() {
    if (!selectedCity || !legStart || !legEnd || legs.length >= TRIP_MAX_LEGS) return
    setLegs((current) => [...current, makeLeg(selectedCity, legStart, legEnd)])
    setCityQuery('')
    setSelectedCity(null)
    setLegStart('')
    setLegEnd('')
  }

  function selectCity(city: City) {
    setSelectedCity(city)
    setCityQuery(cityLabel(city))
    // Prefill the stay dates so a city can be added in one tap for the common
    // case: the first leg picks up the trip's start; each later leg continues
    // from where the previous one ended. The user can still adjust before
    // adding.
    if (!legStart) {
      const defaultStart = legs.length > 0 ? legs[legs.length - 1].endDate : startDate
      setLegStart(defaultStart)
      if (!legEnd) setLegEnd(defaultStart || endDate)
    }
  }

  function removeLeg(index: number) {
    setLegs((current) => current.filter((_, i) => i !== index))
  }

  function moveLeg(index: number, direction: -1 | 1) {
    setLegs((current) => {
      const target = index + direction
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function toggleEquipment(id: string) {
    setEquipment((current) => (current.includes(id) ? current.filter((v) => v !== id) : [...current, id]))
  }

  function toggleInterest(categoryKinds: string[]) {
    setInterests((current) => {
      const active = categoryKinds.every((kind) => current.includes(kind))
      return active ? current.filter((kind) => !categoryKinds.includes(kind)) : [...new Set([...current, ...categoryKinds])]
    })
  }

  function advance() {
    setError('')
    if (stepIndex + 1 >= TRIP_BUILDER_STEPS.length) handleSave()
    else setStepIndex(stepIndex + 1)
  }

  function goBack() {
    setError('')
    if (stepIndex > 0) setStepIndex(stepIndex - 1)
  }

  const canSave = startDate && endDate && legs.length > 0 && equipment.length > 0 && endDate >= startDate
  const canContinue = step === 'dates'
    ? Boolean(startDate && endDate && endDate >= startDate)
    : step === 'cities'
      ? legs.length > 0
      : step === 'equipment'
        ? equipment.length > 0
        : true

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
      setSaving(false)
    }
  }

  return (
    <section className="widget-section trip-builder">
      <div className="trip-builder-progress">
        {TRIP_BUILDER_STEPS.map((s, i) => (
          <span key={s} className={`trip-builder-progress-step${i === stepIndex ? ' is-current' : ''}${i < stepIndex ? ' is-complete' : ''}`}>
            <span className="trip-builder-dot" />
            <span>{TRIP_BUILDER_STEP_LABELS[s]}</span>
          </span>
        ))}
      </div>

      <div className="trip-builder-steps">
        <AnimatePresence mode="wait">
          {step === 'dates' && (
            <TripBuilderStepDates
              key="dates"
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
            />
          )}

          {step === 'cities' && (
            <TripBuilderStepCities
              key="cities"
              legs={legs}
              startDate={startDate}
              endDate={endDate}
              cityQuery={cityQuery}
              selectedCity={selectedCity}
              legStart={legStart}
              legEnd={legEnd}
              issues={legIssues}
              onCityQueryChange={(q) => {
                setCityQuery(q)
                setSelectedCity(null)
              }}
              onSelectCity={selectCity}
              onLegStartChange={setLegStart}
              onLegEndChange={setLegEnd}
              onAddLeg={addLeg}
              onRemoveLeg={removeLeg}
              onMoveLeg={moveLeg}
            />
          )}

          {step === 'equipment' && (
            <TripBuilderStepEquipment
              key="equipment"
              equipment={equipment}
              onToggleEquipment={toggleEquipment}
              onTogglePhoneModel={(id) => toggleEquipment(id)}
            />
          )}

          {step === 'interests' && (
            <TripBuilderStepInterests
              key="interests"
              interests={interests}
              onToggleCategory={toggleInterest}
            />
          )}

          {step === 'review' && (
            <TripBuilderStepReview
              key="review"
              startDate={startDate}
              endDate={endDate}
              legs={legs}
              equipment={equipment}
              interests={interests}
            />
          )}
        </AnimatePresence>
      </div>

      {error && <p className="account-form-error">{error}</p>}

      <div className="trip-builder-actions">
        {stepIndex > 0 && (
          <button type="button" className="trip-builder-back" onClick={goBack}>
            Back
          </button>
        )}
        {stepIndex < TRIP_BUILDER_STEPS.length - 1 && (
          <button type="button" className="trip-builder-continue" disabled={!canContinue} onClick={advance}>
            Continue
          </button>
        )}
        {stepIndex === TRIP_BUILDER_STEPS.length - 1 && (
          <button type="button" className="trip-builder-save" disabled={!canSave || saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save trip'}
          </button>
        )}
      </div>
    </section>
  )
}

function TripBuilderStepDates({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: {
  startDate: string
  endDate: string
  onStartDateChange: (date: string) => void
  onEndDateChange: (date: string) => void
}) {
  return (
    <motion.div
      className="trip-builder-step-content"
      initial={{ x: 24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -24, opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <h3>When will you travel?</h3>
      <div className="trip-date-row">
        <label>
          Start date
          <input type="date" value={startDate} onChange={(e) => onStartDateChange(e.target.value)} autoFocus />
        </label>
        <label>
          End date
          <input type="date" value={endDate} min={startDate || undefined} onChange={(e) => onEndDateChange(e.target.value)} />
        </label>
      </div>
    </motion.div>
  )
}

function TripBuilderStepCities({
  legs,
  startDate,
  endDate,
  cityQuery,
  selectedCity,
  legStart,
  legEnd,
  issues,
  onCityQueryChange,
  onSelectCity,
  onLegStartChange,
  onLegEndChange,
  onAddLeg,
  onRemoveLeg,
  onMoveLeg,
}: {
  legs: TripLeg[]
  startDate: string
  endDate: string
  cityQuery: string
  selectedCity: City | null
  legStart: string
  legEnd: string
  issues: string[]
  onCityQueryChange: (q: string) => void
  onSelectCity: (city: City) => void
  onLegStartChange: (date: string) => void
  onLegEndChange: (date: string) => void
  onAddLeg: () => void
  onRemoveLeg: (i: number) => void
  onMoveLeg: (i: number, direction: -1 | 1) => void
}) {
  return (
    <motion.div
      className="trip-builder-step-content"
      initial={{ x: 24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -24, opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <h3>Which cities? ({legs.length}/{TRIP_MAX_LEGS})</h3>

      {legs.length > 0 && (
        <ul className="row-list trip-leg-list">
          {legs.map((leg, index) => (
            <li key={`${leg.cityKey}-${leg.startDate}`} className="trip-leg-row">
              <span>
                <strong>{leg.cityName}</strong> · {leg.startDate} to {leg.endDate}
              </span>
              <span className="trip-leg-row-actions">
                <button
                  type="button"
                  className="trip-leg-move"
                  onClick={() => onMoveLeg(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${leg.cityName} earlier`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="trip-leg-move"
                  onClick={() => onMoveLeg(index, 1)}
                  disabled={index === legs.length - 1}
                  aria-label={`Move ${leg.cityName} later`}
                >
                  ↓
                </button>
                <button type="button" onClick={() => onRemoveLeg(index)} aria-label={`Remove ${leg.cityName}`}>
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {issues.length > 0 && (
        <ul className="trip-leg-warnings" role="status">
          {issues.map((issue) => (
            <li key={issue}>⚠ {issue}</li>
          ))}
        </ul>
      )}

      {legs.length < TRIP_MAX_LEGS && (
        <div className="trip-add-leg">
          <LocationSearchInput
            id="trip-city-search"
            value={cityQuery}
            onChange={onCityQueryChange}
            onSelect={onSelectCity}
            placeholder="Search any town or city"
          />
          <div className="trip-date-row">
            <label>
              From
              <input type="date" value={legStart} min={startDate || undefined} max={endDate || undefined} onChange={(e) => onLegStartChange(e.target.value)} />
            </label>
            <label>
              To
              <input type="date" value={legEnd} min={legStart || startDate || undefined} max={endDate || undefined} onChange={(e) => onLegEndChange(e.target.value)} />
            </label>
          </div>
          {selectedCity && (
            <div className="trip-city-selection">
              <span>Selected: <strong>{cityLabel(selectedCity)}</strong></span>
              <button type="button" onClick={onAddLeg} disabled={!legStart || !legEnd}>
                Add city
              </button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}

function TripBuilderStepEquipment({
  equipment,
  onToggleEquipment,
  onTogglePhoneModel,
}: {
  equipment: string[]
  onToggleEquipment: (id: string) => void
  onTogglePhoneModel: (id: string) => void
}) {
  return (
    <motion.div
      className="trip-builder-step-content"
      initial={{ x: 24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -24, opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <h3>What gear are you bringing?</h3>
      <p className="trip-hint">Viewing instruments</p>
      <div className="filter-tabs">
        {VIEWING_INSTRUMENTS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={equipment.includes(option.id) ? 'is-active' : ''}
            onClick={() => onToggleEquipment(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <PhonePicker selected={equipment} onToggle={onTogglePhoneModel} />
    </motion.div>
  )
}

function TripBuilderStepInterests({
  interests,
  onToggleCategory,
}: {
  interests: string[]
  onToggleCategory: (kinds: string[]) => void
}) {
  return (
    <motion.div
      className="trip-builder-step-content"
      initial={{ x: 24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -24, opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <h3>What interests you?</h3>
      <p className="trip-hint">We'll highlight these in your personalized city guides.</p>
      <InterestsPicker selected={interests} onToggleCategory={onToggleCategory} />
    </motion.div>
  )
}

function TripBuilderStepReview({
  startDate,
  endDate,
  legs,
  equipment,
  interests,
}: {
  startDate: string
  endDate: string
  legs: TripLeg[]
  equipment: string[]
  interests: string[]
}) {
  return (
    <motion.div
      className="trip-builder-step-content"
      initial={{ x: 24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -24, opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <h3>Ready to go?</h3>
      <div className="trip-review">
        <div className="trip-review-section">
          <strong>Trip dates</strong>
          <p>{startDate} to {endDate}</p>
        </div>
        <div className="trip-review-section">
          <strong>Cities ({legs.length})</strong>
          <ul>
            {legs.map((leg) => (
              <li key={leg.cityKey}>
                {leg.cityName} · {leg.startDate} to {leg.endDate}
              </li>
            ))}
          </ul>
        </div>
        <div className="trip-review-section">
          <strong>Gear ({equipment.length} items)</strong>
          <ul>
            {equipment.map((id) => (
              <li key={id}>{CAMERA_PROFILES[id as DeviceId]?.name || VIEWING_INSTRUMENTS.find((v) => v.id === id)?.label || id}</li>
            ))}
          </ul>
        </div>
        <div className="trip-review-section">
          <strong>Interests ({interests.length})</strong>
          <p className="trip-hint">{interests.length > 0 ? 'Set in your personalized guides' : 'None selected'}</p>
        </div>
      </div>
    </motion.div>
  )
}

function PhonePicker({ selected, onToggle }: { selected: string[]; onToggle: (id: string) => void }) {
  const selectedPhoneIds = selected.filter((id) => id in CAMERA_PROFILES) as DeviceId[]
  const selectedPhoneNames = selectedPhoneIds.map((id) => CAMERA_PROFILES[id]?.name || id)

  return (
    <div className="trip-phone-picker">
      <p className="trip-hint">Phone models</p>

      {selectedPhoneIds.length > 0 && (
        <div className="trip-phone-picker-selected">
          <div className="trip-phone-picker-selected-label">Selected:</div>
          <div className="trip-phone-picker-chips">
            {selectedPhoneNames.map((name, i) => (
              <div key={selectedPhoneIds[i]} className="trip-phone-picker-chip">
                <span>{name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${name}`}
                  onClick={() => onToggle(selectedPhoneIds[i])}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {MAKER_ORDER.map((maker) => {
        const models = modelsForMaker(maker)
        return (
          <div key={maker} className="trip-phone-picker-section">
            <div className="trip-phone-picker-maker">{MAKER_LABELS[maker]}</div>
            <div className="filter-tabs trip-phone-models">
              {models.map((profile) => (
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
      })}
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
