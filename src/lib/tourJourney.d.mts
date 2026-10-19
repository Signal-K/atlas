export const FIRST_TOUR_ID: 'tonight-first-light-v1'
export const FIRST_TOUR_BADGE: 'first_light'

export interface FirstTourCompletion {
  tourId: typeof FIRST_TOUR_ID
  badge: typeof FIRST_TOUR_BADGE
  completedAt: string
  targetId: string
  targetTitle: string
}

export function tourAnalyticsProperties(input: {
  locationPresent: boolean
  authenticated: boolean
  incentiveEligible?: boolean
}): {
  tour_id: typeof FIRST_TOUR_ID
  location_present: boolean
  account_state: 'authed' | 'guest'
  incentive_eligible: boolean
}

export function createTourCompletion(input: {
  completedAt: string
  targetId: string
  targetTitle: string
}): FirstTourCompletion

export function pickNextTourTarget<T extends { eventId: string }>(targets: T[], completedTargetId: string): T | null
