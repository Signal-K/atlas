import type { SkyEvent } from '../lib/db'

export function EventRow({ event, expanded, onToggle }: { event: SkyEvent; expanded: boolean; onToggle: () => void }) {
  return (
    <li>
      <button type="button" className="row-trigger" onClick={onToggle} aria-expanded={expanded}>
        <span className="row-marker" />
        <span className="row-text">{event.title}</span>
        <span className="row-meta">
          {new Date(event.startsAt).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </span>
      </button>
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
