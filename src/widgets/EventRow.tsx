import type { SkyEvent } from '../lib/db'

interface EventRowProps {
  event: SkyEvent
  expanded: boolean
  onToggle: () => void
  pinned?: boolean
  onTogglePin?: () => void
}

export function EventRow({ event, expanded, onToggle, pinned, onTogglePin }: EventRowProps) {
  return (
    <li>
      <div className="row-trigger">
        <button type="button" className="row-trigger-main" onClick={onToggle} aria-expanded={expanded}>
          <span className="row-marker" />
          <span className="row-text">{event.title}</span>
          <span className="row-meta">
            {new Date(event.startsAt).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </span>
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
        </div>
      )}
    </li>
  )
}
