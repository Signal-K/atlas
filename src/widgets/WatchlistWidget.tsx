import { useEffect, useState } from 'react'
import { registerWidget } from './registry'
import {
  addToWatchlist,
  formatWatchValue,
  getWatchableTargets,
  getWatchlist,
  isWatching,
  removeFromWatchlist,
  type WatchlistItem,
} from '../lib/watchlist'

export const EVENT_KINDS = [
  { value: 'moon_phase', label: 'Moon phases' },
  { value: 'meteor_shower', label: 'Meteor showers' },
  { value: 'eclipse', label: 'Eclipses' },
  { value: 'iss_pass', label: 'ISS passes' },
  { value: 'planet_event', label: 'Planet events' },
  { value: 'deep_sky', label: 'Deep-sky objects' },
  { value: 'conjunction', label: 'Conjunctions' },
]

function WatchlistWidget() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[] | null>(null)
  const [targets, setTargets] = useState<string[]>([])

  async function refresh() {
    setWatchlist(await getWatchlist())
    setTargets(await getWatchableTargets())
  }

  useEffect(() => {
    refresh()
  }, [])

  async function toggle(kind: WatchlistItem['kind'], value: string, watching: boolean) {
    if (watching) await removeFromWatchlist(kind, value)
    else await addToWatchlist(kind, value)
    await refresh()
  }

  if (watchlist === null) return <p>Loading&hellip;</p>

  return (
    <div>
      <p className="scrapbook-hint">Watch an event type or a specific target to flag it wherever it appears, and (once notifications land) get a heads-up for good viewing.</p>
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
      {targets.length > 0 && (
        <>
          <p className="settings-label chip-row-label">Specific targets</p>
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
        </>
      )}
    </div>
  )
}

registerWidget({
  id: 'watchlist',
  title: 'Watchlist',
  Component: WatchlistWidget,
  defaultEnabled: true,
})
