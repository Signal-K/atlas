import { pb } from './pocketbase'
import { trackEvent } from './analytics'
import {
  FIRST_TOUR_BADGE,
  FIRST_TOUR_ID,
  createTourCompletion,
  tourAnalyticsProperties,
  type FirstTourCompletion,
} from './tourJourney.mjs'

const COMPLETION_KEY = 'atlas-first-tour-completion-v1'

function safeReadCompletion(): FirstTourCompletion | null {
  try {
    const raw = localStorage.getItem(COMPLETION_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<FirstTourCompletion>
    return value.tourId === FIRST_TOUR_ID && value.badge === FIRST_TOUR_BADGE && value.completedAt && value.targetId && value.targetTitle
      ? value as FirstTourCompletion
      : null
  } catch {
    return null
  }
}

function safeWriteCompletion(completion: FirstTourCompletion): void {
  try {
    localStorage.setItem(COMPLETION_KEY, JSON.stringify(completion))
  } catch {
    // A storage failure must not prevent the observer finishing the tour.
  }
}

export function getFirstTourCompletion(accountCompletedAt?: string | null): FirstTourCompletion | null {
  const local = safeReadCompletion()
  if (local) return local
  if (!accountCompletedAt) return null
  return createTourCompletion({
    completedAt: accountCompletedAt,
    targetId: 'account-history',
    targetTitle: 'First guided look',
  })
}

export function tourProperties(locationPresent: boolean, authenticated: boolean) {
  const accountCompletedAt = typeof pb.authStore.record?.first_tour_completed_at === 'string'
    ? pb.authStore.record.first_tour_completed_at
    : null
  return tourAnalyticsProperties({ locationPresent, authenticated, incentiveEligible: !getFirstTourCompletion(accountCompletedAt) })
}

export async function completeFirstTour(input: {
  targetId: string
  targetTitle: string
  locationPresent: boolean
  authenticated: boolean
  accountCompletedAt?: string | null
}): Promise<{ completion: FirstTourCompletion; firstCompletion: boolean }> {
  const existing = getFirstTourCompletion(input.accountCompletedAt)
  const properties = tourAnalyticsProperties({
    locationPresent: input.locationPresent,
    authenticated: input.authenticated,
    incentiveEligible: !existing,
  })
  const completion = existing ?? createTourCompletion({
    completedAt: new Date().toISOString(),
    targetId: input.targetId,
    targetTitle: input.targetTitle,
  })

  trackEvent('Tour completed', { ...properties, target_id: input.targetId })
  if (existing) return { completion, firstCompletion: false }

  safeWriteCompletion(completion)
  trackEvent('Incentive unlocked', { ...properties, type: 'first_tour', badge: FIRST_TOUR_BADGE })

  if (input.authenticated) await syncFirstTourToAccount(completion)
  return { completion, firstCompletion: true }
}

export async function syncGuestFirstTourToAccount(): Promise<boolean> {
  const completion = safeReadCompletion()
  if (!completion || !pb.authStore.record?.id) return false
  return syncFirstTourToAccount(completion)
}

async function syncFirstTourToAccount(completion: FirstTourCompletion): Promise<boolean> {
  const id = pb.authStore.record?.id as string | undefined
  if (!id) return false
  try {
    const saved = await pb.collection('users').update(id, {
      first_tour_completed_at: completion.completedAt,
      first_tour_badge: completion.badge,
    })
    pb.authStore.save(pb.authStore.token, saved)
    return true
  } catch (error) {
    trackEvent('sync_failed', { stage: 'first_tour_account_sync', error: String(error) })
    return false
  }
}
