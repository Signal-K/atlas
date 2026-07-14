import { useEffect, useState } from 'react'
import { SkyMapCanvas } from '../../components/SkyMapCanvas'
import { getTonightPlan, type TonightPlan } from '../../lib/tonightTargets'
import { fetchViewingAdvisory, type DailyViewingAdvisory } from '../../lib/weather'
import { pullSkyEvents } from '../../lib/sync'
import { formatWatchValue, getWatchlist, type WatchlistItem } from '../../lib/watchlist'
import { getWatchTargetStatus, type WatchStatus } from '../../lib/watchStatus'
import type { CurrentLocation } from '../../lib/currentLocation'
import type { MobileTab } from '../../components/BottomNav'

interface HubViewProps {
  city: CurrentLocation
  onOpenTab: (tab: MobileTab) => void
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function HubView({ city, onOpenTab }: HubViewProps) {
  const [plan, setPlan] = useState<TonightPlan | null>(null)
  const [advisory, setAdvisory] = useState<DailyViewingAdvisory | null>(null)
  const [watchlist, setWatchlist] = useState<Array<WatchlistItem & { status: WatchStatus }>>([])
  const [clarity, setClarity] = useState(70)
  const [clarityTouched, setClarityTouched] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      await pullSkyEvents()
      const [tonightPlan, advisoryDays, items] = await Promise.all([
        getTonightPlan(city.lat, city.lon),
        fetchViewingAdvisory(city.lat, city.lon, 1).catch(() => []),
        getWatchlist(),
      ])
      if (cancelled) return
      setPlan(tonightPlan)
      setAdvisory(advisoryDays[0] ?? null)
      if (!clarityTouched) setClarity(advisoryDays[0] ? 100 - advisoryDays[0].cloudCoverPct : 70)

      const cloudCoverPct = advisoryDays[0]?.cloudCoverPct
      const withStatus = await Promise.all(
        items.map(async (item) => ({
          ...item,
          status: await getWatchTargetStatus(item, city.lat, city.lon, new Date(), cloudCoverPct),
        })),
      )
      if (!cancelled) setWatchlist(withStatus)
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clarityTouched intentionally excluded, see below
  }, [city])

  if (!plan) {
    return <div className="mobile-hub-loading">Loading tonight&rsquo;s sky&hellip;</div>
  }

  const topTarget = plan.targets[0]
  const sunsetAt = plan.darknessWindow.civilDuskAt

  return (
    <div className="mobile-hub">
      <section className="mobile-card">
        <div className="mobile-card-eyebrow">Current conditions</div>
        <div className="mobile-conditions-grid">
          <div className="mobile-condition-cell">
            <div className="mobile-condition-value">{advisory ? `${Math.round(advisory.cloudCoverPct)}%` : '—'}</div>
            <div className="mobile-condition-label">Cloud cover</div>
          </div>
          <div className="mobile-condition-cell">
            <div className="mobile-condition-value">{advisory ? formatWatchValue(advisory.quality) : '—'}</div>
            <div className="mobile-condition-label">Visibility</div>
          </div>
          <div className="mobile-condition-cell">
            <div className="mobile-condition-value">{sunsetAt ? formatTime(sunsetAt) : '—'}</div>
            <div className="mobile-condition-label">Sunset</div>
          </div>
        </div>
      </section>

      <section className="mobile-card">
        <div className="mobile-card-header">
          <div className="mobile-card-eyebrow">Upcoming tonight</div>
          <button type="button" className="mobile-card-action" onClick={() => onOpenTab('events')} aria-label="View all events">
            &rarr;
          </button>
        </div>
        {plan.targets.length === 0 ? (
          <p className="mobile-empty-hint">
            {plan.rating === 'skip' ? 'Nothing worth going outside for tonight.' : 'No events cached yet — try again once online.'}
          </p>
        ) : (
          <div className="mobile-mini-list">
            {plan.targets.slice(0, 2).map((target) => (
              <button type="button" key={target.eventId} className="mobile-mini-row" onClick={() => onOpenTab('events')}>
                <span className="mobile-mini-row-name">{target.title}</span>
                <span className="mobile-mini-row-meta">{formatTime(target.bestTime)}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="mobile-card">
        <div className="mobile-card-header">
          <div className="mobile-card-eyebrow">Local sky map</div>
          <span className="mobile-card-meta">
            LAT {city.lat.toFixed(2)} &middot; LON {city.lon.toFixed(2)}
          </span>
        </div>
        <div className="sky-map-frame">
          <SkyMapCanvas clarity={clarity} markerLabel={topTarget?.title} />
        </div>
        <div className="clarity-slider-block">
          <div className="clarity-slider-labels">
            <span>Your sky now</span>
            <span>Ideal / clear</span>
          </div>
          <input
            className="clarity-slider"
            type="range"
            min={0}
            max={100}
            value={clarity}
            onChange={(event) => {
              setClarityTouched(true)
              setClarity(Number(event.target.value))
            }}
          />
          <div className="clarity-slider-readout">
            <span>{Math.round(100 - clarity)}% obscured</span>
            {topTarget && <span>{topTarget.title}</span>}
          </div>
        </div>
      </section>

      <section className="mobile-card">
        <div className="mobile-card-header">
          <div className="mobile-card-eyebrow">Watchlist</div>
          <button type="button" className="mobile-card-action" onClick={() => onOpenTab('watch')} aria-label="Manage watchlist">
            +
          </button>
        </div>
        {watchlist.length === 0 ? (
          <p className="mobile-empty-hint">Nothing on your watchlist yet.</p>
        ) : (
          <div className="mobile-watch-grid">
            {watchlist.slice(0, 2).map((item) => (
              <div key={`${item.kind}:${item.value}`} className="mobile-watch-cell">
                <div className="mobile-watch-cell-name">
                  {formatWatchValue(item.value)}
                  {item.status.isGoodViewing && <span className="mobile-good-viewing-badge" title="Good viewing tonight" />}
                </div>
                <div className="mobile-watch-cell-status" data-status={item.status.status}>
                  {item.status.statusLabel} &middot; {item.status.timeLabel}
                </div>
              </div>
            ))}
          </div>
        )}
        <button type="button" className="mobile-view-all" onClick={() => onOpenTab('watch')}>
          View all &rarr;
        </button>
      </section>
    </div>
  )
}
