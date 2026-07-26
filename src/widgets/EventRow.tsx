import type { SkyEvent } from '../lib/db'

export const KIND_LABELS: Record<string, string> = {
  moon_phase: 'Moon',
  meteor_shower: 'Meteor shower',
  eclipse: 'Eclipse',
  iss_pass: 'ISS pass',
  planet_event: 'Planet',
  deep_sky: 'Deep sky',
  conjunction: 'Conjunction',
  satellite_flare: 'Satellite flare',
  aurora: 'Aurora',
  comet: 'Comet',
  night_sky_guide: 'Night guide',
  local_night_sky: 'Local guide',
  asteroid_approach: 'Asteroid',
  fireball: 'Fireball',
}

interface EventRowProps {
  event: SkyEvent
  expanded: boolean
  onToggle: () => void
  pinned?: boolean
  onTogglePin?: () => void
  watching?: boolean
  watchCount?: number
}

export function EventRow({ event, expanded, onToggle, pinned, onTogglePin, watching, watchCount }: EventRowProps) {
  return (
    <li>
      <div className="row-trigger">
        <button type="button" className="row-trigger-main" onClick={onToggle} aria-expanded={expanded}>
          <span className="row-marker" />
          <span className="row-kind">{KIND_LABELS[event.kind] ?? event.kind}</span>
          <span className="row-text">{event.title}</span>
          <span className="row-meta">
            {new Date(event.startsAt).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </span>
          {watching && (
            <span className="row-watch-badge" title="On your watchlist">
              &#128276;
            </span>
          )}
        </button>
        {onTogglePin && (
          <button
            type="button"
            className={`row-pin${pinned ? ' is-active' : ''}`}
            onClick={onTogglePin}
            aria-label={pinned ? 'Unpin event' : 'Pin event'}
            title={pinned ? 'Unpin event' : 'Pin event'}
          >
            ★
          </button>
        )}
      </div>
      {expanded && (
        <div className="row-detail">
          {event.imageUrl && (
            <figure className="row-detail-image">
              <img src={event.imageUrl} alt={event.title} loading="lazy" />
              {event.imageCredit && <figcaption>{event.imageCredit}</figcaption>}
            </figure>
          )}
          <p>{event.content ?? event.description}</p>
          {Boolean(watchCount) && (
            <p className="row-watch-count">
              &#128301; {watchCount} watching this{watching ? ' too' : ''}
            </p>
          )}
        </div>
      )}
    </li>
  )
}
