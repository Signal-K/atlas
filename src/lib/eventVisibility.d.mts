export interface EventVisibility {
  visible: boolean
  reason: string
}

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
