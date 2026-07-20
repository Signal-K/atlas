import { useEffect, useState } from 'react'
import { EVENT_KINDS } from '../../widgets/WatchlistWidget'
import {
  addToWatchlist,
  formatWatchValue,
  getWatchableTargets,
  getWatchlist,
  isWatching,
  removeFromWatchlist,
  type WatchlistItem,
} from '../../lib/watchlist'
import { getWatchTargetStatus, type WatchStatus } from '../../lib/watchStatus'
import { fetchViewingAdvisory } from '../../lib/weather'
import type { CurrentLocation } from '../../lib/currentLocation'

interface WatchViewProps {
  city: CurrentLocation
  onSavedForLater?: () => void
  canAddToPlan?: boolean
  onBlockedPlanAdd?: () => void
}

export function WatchView({ city, onSavedForLater, canAddToPlan = true, onBlockedPlanAdd }: WatchViewProps) {
  const [watchlist, setWatchlist] = useState<Array<WatchlistItem & { status: WatchStatus }> | null>(null)
  const [targets, setTargets] = useState<string[]>([])

  async function refresh() {
    const [items, targetList, advisoryDays] = await Promise.all([
      getWatchlist(),
      getWatchableTargets(),
      fetchViewingAdvisory(city.lat, city.lon, 1).catch(() => []),
    ])
    const cloudCoverPct = advisoryDays[0]?.cloudCoverPct
    const withStatus = await Promise.all(
      items.map(async (item) => ({
        ...item,
        status: await getWatchTargetStatus(item, city.lat, city.lon, new Date(), cloudCoverPct),
      })),
    )
    setWatchlist(withStatus)
    setTargets(targetList)
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh recreated per render is fine, only city.lat/lon matter
  }, [city.lat, city.lon])

  async function toggle(kind: WatchlistItem['kind'], value: string, watching: boolean) {
    if (!watching && !canAddToPlan) {
      onBlockedPlanAdd?.()
      return
    }
    if (watching) {
      await removeFromWatchlist(kind, value)
    } else {
      await addToWatchlist(kind, value)
      onSavedForLater?.()
    }
    await refresh()
  }

  if (watchlist === null) return <p className="mobile-empty-hint">Loading&hellip;</p>

  return (
    <div className="mobile-watch">
      <section className="mobile-card">
        <div className="mobile-card-eyebrow">Watching</div>
        {watchlist.length === 0 ? (
          <p className="mobile-empty-hint">Nothing on your watchlist yet — add something below.</p>
        ) : (
          <ul className="mobile-watch-list">
            {watchlist.map((item) => (
              <li key={`${item.kind}:${item.value}`} className="mobile-watch-row">
                <div className="mobile-watch-row-main">
                  <span className="mobile-watch-row-name">
                    {formatWatchValue(item.value)}
                    {item.status.isGoodViewing && <span className="mobile-good-viewing-badge" title="Good viewing tonight" />}
                  </span>
                  <span className="mobile-watch-row-status" data-status={item.status.status}>
                    {item.status.statusLabel} &middot; {item.status.timeLabel}
                  </span>
                </div>
                <button
                  type="button"
                  className="mobile-watch-remove"
                  onClick={() => toggle(item.kind, item.value, true)}
                  aria-label={`Remove ${formatWatchValue(item.value)} from watchlist`}
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mobile-card">
        <div className="mobile-card-eyebrow">Event types</div>
        <div className="chip-row">
          {EVENT_KINDS.map((kind) => {
            const watching = isWatching(watchlist, 'event_type', kind.value)
            return (
              <button
                key={kind.value}
                type="button"
                className={`chip${watching ? ' is-active' : ''}`}
                onClick={() => toggle('event_type', kind.value, watching)}
              >
                {kind.label}
              </button>
            )
          })}
        </div>
      </section>

      {targets.length > 0 && (
        <section className="mobile-card">
          <div className="mobile-card-eyebrow">Specific targets</div>
          <div className="chip-row">
            {targets.map((target) => {
              const watching = isWatching(watchlist, 'target', target)
              return (
                <button
                  key={target}
                  type="button"
                  className={`chip${watching ? ' is-active' : ''}`}
                  onClick={() => toggle('target', target, watching)}
                >
                  {formatWatchValue(target)}
                </button>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
