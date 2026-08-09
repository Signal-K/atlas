import { pb } from './pocketbase'
import type { AtlasEvent } from './events'

// "Log it" writes a check-in to atlas_observations (see EventDetailPage) --
// only offered once an event has actually started. Mock event ids (offline/
// demo mode) don't exist in the real sky_events collection, so the `event`
// relation is only set for real records; the log still carries target_name
// either way.

export async function hasLoggedObservation(userId: string, event: AtlasEvent): Promise<boolean> {
  try {
    await pb.collection('atlas_observations').getFirstListItem(`user = "${userId}" && event = "${event.id}"`)
    return true
  } catch {
    return false
  }
}

export async function logObservation(userId: string, event: AtlasEvent): Promise<void> {
  const payload: Record<string, unknown> = {
    user: userId,
    observed_at: new Date().toISOString(),
    target_name: event.title,
  }
  if (!event.id.startsWith('mock-')) payload.event = event.id
  await pb.collection('atlas_observations').create(payload)
}

// Backs the Calendar view's "tonight's cluster" pick (see clusters.ts):
// lower-cases each logged target_name so the caller can do a simple set
// membership check against a cluster's display name without re-normalizing
// at every call site.
export async function fetchObservedTargetNames(userId: string): Promise<Set<string>> {
  try {
    const records = await pb.collection('atlas_observations').getFullList<{ target_name: string }>({
      filter: `user = "${userId}"`,
      fields: 'target_name',
    })
    return new Set(records.map((record) => record.target_name.toLowerCase()))
  } catch {
    return new Set()
  }
}
