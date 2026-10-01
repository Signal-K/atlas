import { db } from './db'
import { projectProgress } from './progress'
import type { ProgressSummary } from './progress'

// Observations-only on purpose: a save toast must not wait on the PocketBase
// trip-plan read, and a diary save never changes the trip's contribution.
export async function snapshotProgress(userId: string, firstTourBadge: 'first_light' | null): Promise<ProgressSummary> {
  const observations = await db.observations.where('userId').equals(userId).toArray()
  return projectProgress({ observations, firstTourBadge })
}
