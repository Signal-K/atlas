import { db } from './db'
import type { ObservationLogEntry } from './db'
import { projectProgress } from './progress'
import type { ProgressSummary } from './progress'
import { recipeKeyForEventKind } from './cameraRecipes'

// Kinds a recipe can stand in for when an entry's event row is not cached
// locally. Guides share the starry_sky recipe, so they are deliberately absent.
const RECIPE_FALLBACK_KINDS = ['planet_event', 'conjunction', 'moon_phase', 'iss_pass', 'meteor_shower', 'eclipse', 'deep_sky']

function kindFromRecipe(recipe: string | undefined): string | undefined {
  if (!recipe) return undefined
  return RECIPE_FALLBACK_KINDS.find((kind) => recipeKeyForEventKind(kind) === recipe)
}

export async function resolveSightingKinds(observations: readonly ObservationLogEntry[]): Promise<Record<string, string>> {
  const eventIds = [...new Set(observations.map((entry) => entry.eventId).filter((id): id is string => Boolean(id)))]
  const events = eventIds.length > 0 ? await db.skyEvents.bulkGet(eventIds) : []
  const kindByEventId = new Map(events.flatMap((event) => (event ? [[event.id, event.kind] as const] : [])))

  const kinds: Record<string, string> = {}
  for (const entry of observations) {
    const kind = (entry.eventId ? kindByEventId.get(entry.eventId) : undefined) ?? kindFromRecipe(entry.cameraRecipeUsed)
    if (kind) kinds[entry.id] = kind
  }
  return kinds
}

// Observations-only on purpose: a save toast must not wait on the PocketBase
// trip-plan read, and a diary save never changes the trip's contribution.
export async function snapshotProgress(userId: string, firstTourBadge: 'first_light' | null): Promise<ProgressSummary> {
  const observations = await db.observations.where('userId').equals(userId).toArray()
  return projectProgress({ observations, firstTourBadge, sightingKinds: await resolveSightingKinds(observations) })
}
