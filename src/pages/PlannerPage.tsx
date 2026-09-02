import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MobileIcon } from '../components/mobile/MobileIcon'
import { ItineraryBuilderSheet } from '../components/mobile/ItineraryBuilderSheet'
import { PaywallGate } from '../components/PaywallGate'
import { useAuth } from '../lib/auth'
import { activeLegFor, deleteTripPlan, getActiveTripPlan, saveTripLegGuide, type TripLeg, type TripPlan } from '../lib/tripPlans'
import { requestTripLegGuide } from '../lib/tripGuide'
import { listGetReadyReminders } from '../lib/getReadyReminders'
import { trackEvent } from '../lib/analytics'

const MILKY_WAY_LABEL: Record<'yes' | 'marginal' | 'no', string> = {
  yes: 'Milky Way visible',
  marginal: 'Milky Way marginal',
  no: 'Milky Way washed out',
}

function dowLabel(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()
}
function dayLabel(iso: string): string {
  return new Date(`${iso}T12:00:00`).getDate().toString()
}

export function PlannerPage() {
  const { user, entitlementRefreshing } = useAuth()
  const navigate = useNavigate()
  const [trip, setTrip] = useState<TripPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [builderOpen, setBuilderOpen] = useState(false)
  const [reminderCount, setReminderCount] = useState(0)

  useEffect(() => {
    getActiveTripPlan().then((active) => {
      setTrip(active)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!trip) return
    const reminders = listGetReadyReminders()
    const start = new Date(trip.startDate).getTime()
    const end = new Date(trip.endDate).getTime() + 86_400_000
    setReminderCount(reminders.filter((r) => { const t = new Date(r.startsAt).getTime(); return t >= start && t <= end }).length)
  }, [trip])

  async function handleEndTrip() {
    if (!trip) return
    await deleteTripPlan(trip.id)
    trackEvent('Deleted trip plan', {})
    setTrip(null)
  }

  return (
    <PaywallGate
      user={user}
      entitlementRefreshing={entitlementRefreshing}
      feature="Trip planning"
      description="Plan a trip across multiple cities, tell Atlas what gear you're bringing and what you're into, and get a personalized per-city sky guide -- including whether you'll catch the Milky Way."
      freeBullets="Tonight, 14-day event browsing, check-ins, and your private journal."
      paidBullets="Multi-city trip planning with AI-personalized per-city guides."
      onSignInClick={() => navigate('/app/profile')}
    >
      <div className="az-page">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div>
            <h1 className="az-h1">Planner</h1>
            <p className="az-hero-title">Itineraries across locations and dates.</p>
          </div>
          <span className="az-pill" style={{ '--pill-hue': 288, marginTop: '0.375rem', letterSpacing: '0.1em' } as React.CSSProperties}>
            SKY PASS
          </span>
        </div>

        {loading ? (
          <p className="az-muted" style={{ marginTop: '1rem' }}>Loading your trip…</p>
        ) : !trip ? (
          <div className="az-card" style={{ marginTop: '1.125rem' }}>
            <div className="az-card-body">
              <strong style={{ display: 'block', fontFamily: 'var(--az-font-display)', fontSize: '1.1875rem', marginBottom: '0.375rem' }}>
                No trip yet
              </strong>
              <p className="az-muted" style={{ margin: '0 0 0.875rem', fontSize: '0.84375rem' }}>
                Add the nights you could get out and where from -- Atlas checks each one against forecast and moon.
              </p>
              <button type="button" className="az-btn az-btn-primary az-btn-block" onClick={() => setBuilderOpen(true)}>
                Start a plan
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="az-card" style={{ marginTop: '1.125rem' }}>
              <div className="az-card-body">
                <span className="az-kicker" style={{ color: 'var(--az-teal)' }}>
                  ACTIVE ITINERARY · {trip.legs.length} {trip.legs.length === 1 ? 'NIGHT' : 'NIGHTS'} · {new Set(trip.legs.map((l) => l.cityKey)).size} LOCATION{new Set(trip.legs.map((l) => l.cityKey)).size === 1 ? '' : 'S'}
                </span>
                <strong style={{ display: 'block', fontFamily: 'var(--az-font-display)', fontSize: '1.3125rem', margin: '0.3125rem 0 0.25rem' }}>
                  {trip.legs[0]?.cityName}{trip.legs.length > 1 ? ` → ${trip.legs[trip.legs.length - 1].cityName}` : ''}
                </strong>
                <p className="az-muted" style={{ margin: 0, fontSize: '0.8125rem' }}>
                  {trip.startDate} to {trip.endDate}
                </p>
              </div>
              <div className="az-row-group" style={{ borderRadius: 0, borderLeft: 0, borderRight: 0 }}>
                {trip.legs.map((leg) => (
                  <LegRow key={leg.cityKey} trip={trip} leg={leg} onGuideSaved={setTrip} />
                ))}
              </div>
              <div className="az-btn-row" style={{ padding: '0.75rem 0.9375rem' }}>
                <button type="button" className="az-btn az-btn-primary" style={{ flex: 1 }} onClick={() => setBuilderOpen(true)}>
                  Add a night
                </button>
                <button type="button" className="az-btn az-btn-outline" style={{ flex: 1 }} onClick={() => navigate('/app/profile')}>
                  Camera presets
                </button>
              </div>
            </div>

            {reminderCount > 0 && (
              <div className="az-card" style={{ marginTop: '1rem' }}>
                <div className="az-card-body" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <MobileIcon name="bell" />
                  <span style={{ fontSize: '0.84375rem' }}>
                    {reminderCount} reminder{reminderCount === 1 ? '' : 's'} armed for this trip window.
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              className="az-btn az-btn-outline az-btn-block"
              style={{ marginTop: '1.125rem' }}
              onClick={handleEndTrip}
            >
              End trip
            </button>
          </>
        )}
      </div>

      <ItineraryBuilderSheet open={builderOpen} onClose={() => setBuilderOpen(false)} onSaved={setTrip} existingTrip={trip} />
    </PaywallGate>
  )
}

function LegRow({ trip, leg, onGuideSaved }: { trip: TripPlan; leg: TripLeg; onGuideSaved: (trip: TripPlan) => void }) {
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const isActive = activeLegFor(trip, new Date())?.cityKey === leg.cityKey
  const guide = trip.guides[leg.cityKey]

  async function generate() {
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
    <div style={{ background: 'var(--surface)', padding: '0.8125rem 0.9375rem', borderTop: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
        <span style={{ flex: 'none', width: '2.75rem', textAlign: 'center', paddingTop: '2px' }}>
          <span className="az-muted" style={{ display: 'block', font: '500 0.59375rem var(--az-font-mono)' }}>{dowLabel(leg.startDate)}</span>
          <strong style={{ display: 'block', fontFamily: 'var(--az-font-display)', fontSize: '1.1875rem', lineHeight: 1.1 }}>{dayLabel(leg.startDate)}</strong>
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4375rem' }}>
            <strong style={{ fontSize: '0.9375rem', fontWeight: 500 }}>{leg.cityName}</strong>
            {isActive && <span className="az-pill" style={{ '--pill-hue': 145 } as React.CSSProperties}>NOW</span>}
          </span>
          {guide ? (
            <>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.3125rem', font: '500 0.625rem var(--az-font-mono)', color: 'var(--muted)' }}>
                <span>BORTLE {guide.bortleClass} · {guide.skyQualityLabel}</span>
                <span>{Math.round(guide.moonIlluminationPct)}% MOON</span>
                <span>{MILKY_WAY_LABEL[guide.milkyWayVisible]}</span>
              </div>
              <p style={{ margin: '0.4375rem 0 0', fontSize: '0.8125rem' }}>{guide.narrative}</p>
              <button type="button" className="az-text-btn" style={{ padding: '0.375rem 0' }} onClick={generate} disabled={generating}>
                {generating ? 'Regenerating…' : 'Regenerate guide'}
              </button>
            </>
          ) : (
            <button type="button" className="az-chip" style={{ marginTop: '0.5rem' }} onClick={generate} disabled={generating}>
              {generating ? 'Generating…' : 'Generate guide'}
            </button>
          )}
          {error && <p style={{ color: 'var(--az-flagship)', fontSize: '0.75rem', margin: '0.25rem 0 0' }}>{error}</p>}
        </span>
      </div>
    </div>
  )
}
