import type { SkyEvent } from '../lib/db'
import { KIND_LABELS } from './EventRow'

export interface SignedUpEventsWidgetProps {
  events: SkyEvent[]
  onSubmit: (event: SkyEvent) => void
  now?: Date
}

// Renders the tagged (signed-up) events that eventTags.getSignedUpEventsDueSoon
// already filtered to "ongoing or starting within 48h" -- this widget only
// handles layout/labeling, not the due-soon window itself.
export function SignedUpEventsWidget({ events, onSubmit, now = new Date() }: SignedUpEventsWidgetProps) {
  if (events.length === 0) return null

  return (
    <div className="az-row-group">
      {events.map((event) => {
        const ongoing = new Date(event.startsAt).getTime() <= now.getTime()
        return (
          <button type="button" key={event.id} className="az-row" onClick={() => onSubmit(event)}>
            <span className="az-row-main">
              <span className="az-row-kind">
                {(KIND_LABELS[event.kind] ?? event.kind).toUpperCase()} · {ongoing ? 'LIVE NOW' : timeUntil(event.startsAt, now)}
              </span>
              <span className="az-row-title">{event.title}</span>
            </span>
            <span className="az-row-trail">
              <span className="az-row-note">Submit</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function timeUntil(startsAt: string, now: Date): string {
  const hours = Math.max(1, Math.round((new Date(startsAt).getTime() - now.getTime()) / 3_600_000))
  return hours < 24 ? `IN ${hours}H` : `IN ${Math.round(hours / 24)}D`
}
