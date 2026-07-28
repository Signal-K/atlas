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
import { SignupWelcomeBeat } from '../components/SignupWelcomeBeat'
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

export const FEATURED_TARGETS = ['moon', 'jupiter', 'mars', 'saturn', 'venus', 'geminids', 'leonids', 'orionids', 'perseids', 'lyrids', 'm31', 'm42']

function WatchlistWidget() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[] | null>(null)
  const [targets, setTargets] = useState<string[]>([])
  const [targetQuery, setTargetQuery] = useState('')
  const [mergeStatus, setMergeStatus] = useState<string | null>(null)
  const [welcomeMergedCount, setWelcomeMergedCount] = useState<number | null>(null)
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

  const watchedTargets = watchlist.filter((item) => item.kind === 'target').map((item) => item.value)
  const normalizedQuery = targetQuery.trim().toLocaleLowerCase()
  const matchingTargets = normalizedQuery
    ? targets.filter((target) => formatWatchValue(target).toLocaleLowerCase().includes(normalizedQuery))
    : FEATURED_TARGETS.filter((target) => targets.includes(target))
  const visibleTargets = Array.from(new Set([...watchedTargets, ...matchingTargets])).slice(0, normalizedQuery ? 20 : 14)
  const hiddenTargetCount = Math.max(0, (normalizedQuery ? matchingTargets.length : targets.length) - visibleTargets.length)

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
            setWelcomeMergedCount(mergedCount)
            refresh()
          }}
        />
      )}
      {welcomeMergedCount != null && (
        <SignupWelcomeBeat
          mergedCount={welcomeMergedCount}
          onDone={() => {
            setMergeStatus(
              welcomeMergedCount > 0
                ? `Account created — brought over ${welcomeMergedCount} saved item${welcomeMergedCount === 1 ? '' : 's'}.`
                : 'Account created.',
            )
            setWelcomeMergedCount(null)
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
          <div className="watchlist-target-heading">
            <p className="settings-label chip-row-label">Specific targets</p>
            <span>{normalizedQuery ? `${matchingTargets.length} matches` : `${targets.length} in catalogue`}</span>
          </div>
          <input
            className="watchlist-target-search"
            type="search"
            value={targetQuery}
            onChange={(event) => setTargetQuery(event.currentTarget.value)}
            placeholder="Search the target catalogue"
            aria-label="Search the target catalogue"
          />
          <div className="chip-row">
            {visibleTargets.map((target) => {
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
          {hiddenTargetCount > 0 && <p className="scrapbook-hint">Search to find the other {hiddenTargetCount} targets.</p>}
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
