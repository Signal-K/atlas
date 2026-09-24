export const FIRST_TOUR_ID = 'tonight-first-light-v1'
export const FIRST_TOUR_BADGE = 'first_light'

export function tourAnalyticsProperties({ locationPresent, authenticated, incentiveEligible = true }) {
  return {
    tour_id: FIRST_TOUR_ID,
    location_present: Boolean(locationPresent),
    account_state: authenticated ? 'authed' : 'guest',
    incentive_eligible: Boolean(incentiveEligible),
  }
}
export function createTourCompletion({ completedAt, targetId, targetTitle }) {
  return {
    tourId: FIRST_TOUR_ID,
    badge: FIRST_TOUR_BADGE,
    completedAt,
    targetId,
    targetTitle,
  }
}

export function pickNextTourTarget(targets, completedTargetId) {
  return targets.find((target) => target.eventId !== completedTargetId) ?? null
}
