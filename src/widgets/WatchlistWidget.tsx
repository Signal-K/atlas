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
import { SignupWallModal } from '../components/SignupWallModal'
import { useSignupWall } from '../lib/useSignupWall'

export const EVENT_KINDS = [
  { value: 'moon_phase', label: 'Moon phases' },
  { value: 'meteor_shower', label: 'Meteor showers' },
  { value: 'eclipse', label: 'Eclipses' },
  { value: 'iss_pass', label: 'ISS passes' },
  { value: 'planet_event', label: 'Planet events' },
  { value: 'deep_sky', label: 'Deep-sky objects' },
  { value: 'conjunction', label: 'Conjunctions' },
  { value: 'satellite_flare', label: 'Satellite flares' },
  { value: 'aurora', label: 'Aurora' },
  { value: 'comet', label: 'Comets' },
  { value: 'night_sky_guide', label: 'Night-sky guides' },
  { value: 'local_night_sky', label: 'Local guides' },
]

function WatchlistWidget() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[] | null>(null)
  const [targets, setTargets] = useState<string[]>([])
  const [mergeStatus, setMergeStatus] = useState<string | null>(null)
  const signupWall = useSignupWall()

  async function refresh() {
    setWatchlist(await getWatchlist())
    setTargets(await getWatchableTargets())
  }

  useEffect(() => {
    refresh()
  }, [])

  async function toggle(kind: WatchlistItem['kind'], value: string, watching: boolean) {
    if (watching) {
      await removeFromWatchlist(kind, value)
    } else {
      await addToWatchlist(kind, value)
      signupWall.promptAfterSave('favourite')
    }
    await refresh()
  }

  if (watchlist === null) return <p>Loading&hellip;</p>

  return (
    <div>
      <p className="scrapbook-hint">Watch an event type or a specific target to flag it wherever it appears, and (once notifications land) get a heads-up for good viewing.</p>
      {mergeStatus && <p className="scrapbook-hint">{mergeStatus}</p>}
      {signupWall.reason && (
        <SignupWallModal
          reason={signupWall.reason}
          onDismiss={signupWall.dismiss}
          onSignedUp={(mergedCount) => {
            signupWall.complete()
            setMergeStatus(
              mergedCount > 0 ? `Account created — brought over ${mergedCount} saved item${mergedCount === 1 ? '' : 's'}.` : 'Account created.',
            )
            refresh()
          }}
        />
      )}
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
