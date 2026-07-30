import { Link } from 'react-router-dom'
import { categoryForKind, isRealEvent } from '../lib/eventCategories'
import { MobileIcon } from './mobile/MobileIcon'
import { trackEvent } from '../lib/analytics'
import type { SkyEvent } from '../lib/db'
import type { Discovery } from '../lib/discoveries'
import { matchExamplePhotos } from '../lib/examplePhotos'

function formatCardDate(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone })
}

interface HighlightCardsProps {
  events: SkyEvent[]
  timeZone?: string
  limit?: number
  /** Sky Pass-only: real photos from nearby community discoveries, matched per card. */
  examplePhotos?: { discoveries: Discovery[]; city: { lat: number; lon: number } }
  showDiscoverMore?: boolean
  className?: string
}

// Visual "You can see" cards -- icon, date, title -- replacing the old
// single-line text summary. Reused as-is by the premium global feed so both
// surfaces read as one visual language.
export function HighlightCards({ events, timeZone, limit = 4, examplePhotos, showDiscoverMore, className }: HighlightCardsProps) {
  const cards = events.filter((event) => isRealEvent(event.kind)).slice(0, limit)
  if (cards.length === 0) return null

  return (
    <div className={`highlight-cards${className ? ` ${className}` : ''}`}>
      <div className="highlight-cards-row">
        {cards.map((event) => {
          const category = categoryForKind(event.kind)
          const photo = examplePhotos
            ? matchExamplePhotos(examplePhotos.discoveries, event, examplePhotos.city)[0]
            : undefined
          return (
            <article key={event.id} className="highlight-card">
              <div className="highlight-card-media">
                {photo?.imageUrl ? (
                  <img src={photo.imageUrl} alt="" loading="lazy" />
                ) : (
                  <span className="highlight-card-icon">
                    <MobileIcon name={category?.icon ?? 'moon'} />
                  </span>
                )}
              </div>
              <span className="highlight-card-date">{formatCardDate(event.startsAt, timeZone)}</span>
              <span className="highlight-card-title">{event.title}</span>
              {photo && (
                <span className="highlight-card-photo-credit">
                  Photo: {photo.authorName}
                  {photo.distanceKm != null ? ` · ${Math.round(photo.distanceKm)} km away` : ''}
                </span>
              )}
            </article>
          )
        })}
      </div>
      {showDiscoverMore && (
        <Link
          to="/app/explore"
          className="highlight-cards-discover-more"
          onClick={() => trackEvent('Discover more events clicked', { source: 'highlights' })}
        >
          Discover more events →
        </Link>
      )}
    </div>
  )
}
