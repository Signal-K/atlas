export interface EventVisibility {
  visible: boolean
  reason: string
}

/**
 * Half-width, in hours, of the window applied to events that carry a single
 * instant rather than a viewing span (`starts_at === ends_at`).
 */
export const POINT_EVENT_WINDOW_HOURS: number

export function visibilityForEvent(event: {
  kind: string
  target: string
  startsAt: string
  endsAt: string
}, lat: number, lon: number): EventVisibility

export function isVisibleFromLocation(event: {
  kind: string
  target: string
  startsAt: string
  endsAt: string
}, lat: number, lon: number): boolean
