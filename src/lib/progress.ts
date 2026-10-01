import type { ObservationLogEntry } from './db'
import type { TripPlan } from './tripPlans'
import { categoryForKind, GUIDE_KIND_IDS } from './eventCategories.ts'

export const LEVEL_THRESHOLDS = [0, 40, 100, 180, 300] as const

export const PROGRESS_SKILLS = ['observing', 'photography', 'planning', 'community'] as const
export type ProgressSkill = typeof PROGRESS_SKILLS[number]

export interface ProgressMilestone {
  id: 'first-trip' | 'first-check-in' | 'first-photo-published' | 'first-guided-look' | 'first-community-night'
  label: string
  achieved: boolean
}

export interface ProgressSummary {
  totalPoints: number
  level: number
  nextLevelAt: number | null
  pointsToNextLevel: number
  skills: Record<ProgressSkill, number>
  // Observing points earned by sky-event kind (conjunction, planet_event, ...),
  // a breakdown of the typed bonus only, not of the per-night base points.
  observingByKind: Record<string, number>
  milestones: ProgressMilestone[]
}

export interface ProgressInput {
  observations: readonly ObservationLogEntry[]
  // A TripPlan is a PocketBase-backed plan. Local draft/localStorage trips
  // deliberately never reach this projector, so they cannot grant points.
  tripPlan?: TripPlan | null
  firstTourBadge?: 'first_light' | null
  // Entry id -> sky-event kind, resolved by the caller (skyEvents join, recipe
  // fallback). Kept as input so this module stays free of Dexie and recipes.
  sightingKinds?: Readonly<Record<string, string>>
}

export const TYPED_SIGHTING_POINTS = 5

// Guides (comet tracker, night-sky guides) are pointer cards, not sightings.
export function isTypedSightingKind(kind: string | undefined): kind is string {
  return kind !== undefined && !GUIDE_KIND_IDS.has(kind) && categoryForKind(kind) !== undefined
}

function civilDate(observedAt: string): string {
  // Observation rows store their chosen local civil date in the ISO prefix.
  // Do not reparse it in the browser's current timezone: a Tallinn night
  // viewed later from another timezone must remain one Tallinn night out.
  return observedAt.slice(0, 10)
}

function hasPhoto(entry: ObservationLogEntry): boolean {
  return Boolean(entry.photo || entry.photoR2Key)
}

// City stamps import this same predicate, so review changes cannot cause a
// diary entry to advance one system but not the other. The module remains
// dependency-free for native TypeScript tests as well as Vite.
export function countsTowardProgress(entry: ObservationLogEntry): boolean {
  return entry.reviewStatus === undefined || entry.reviewStatus === 'not_required' || entry.reviewStatus === 'approved'
}

function levelFor(points: number): { level: number; nextLevelAt: number | null } {
  let level = 1
  for (let index = 1; index < LEVEL_THRESHOLDS.length; index += 1) {
    if (points < LEVEL_THRESHOLDS[index]) return { level, nextLevelAt: LEVEL_THRESHOLDS[index] }
    level += 1
  }
  return { level, nextLevelAt: null }
}

/**
 * Derive the demo progression state from rows Atlas already owns.
 *
 * This intentionally has no persistence or network side effects. It is a
 * projector, not a ledger: callers may run it for a guest or offline user and
 * later replace it with a server-backed idempotent ledger without changing the
 * rules represented here.
 */
export function projectProgress({ observations, tripPlan = null, firstTourBadge = null, sightingKinds = {} }: ProgressInput): ProgressSummary {
  const skills: Record<ProgressSkill, number> = {
    observing: 0,
    photography: 0,
    planning: 0,
    community: 0,
  }
  const qualifying = observations.filter(countsTowardProgress)
  const nights = new Set(qualifying.map((entry) => civilDate(entry.observedAt)))

  // A night is the atomic observing action. Multiple check-ins during it may
  // prove separate photos, but never turn into multiple "went outside" awards.
  skills.observing += nights.size * 10

  const observingByKind: Record<string, number> = {}
  for (const entry of qualifying) {
    const kind = sightingKinds[entry.id]
    if (isTypedSightingKind(kind)) {
      skills.observing += TYPED_SIGHTING_POINTS
      observingByKind[kind] = (observingByKind[kind] ?? 0) + TYPED_SIGHTING_POINTS
    }
    if (hasPhoto(entry)) skills.photography += 8
    if (entry.isPublic === true) skills.photography += 15
  }

  if (tripPlan) {
    skills.planning += 20
    skills.planning += Math.max(0, tripPlan.legs.length - 1) * 5
  }
  if (firstTourBadge === 'first_light') skills.planning += 15

  const totalPoints = Object.values(skills).reduce((total, points) => total + points, 0)
  const { level, nextLevelAt } = levelFor(totalPoints)

  return {
    totalPoints,
    level,
    nextLevelAt,
    pointsToNextLevel: nextLevelAt === null ? 0 : Math.max(0, nextLevelAt - totalPoints),
    skills,
    observingByKind,
    milestones: [
      { id: 'first-trip', label: 'First trip planned', achieved: tripPlan !== null },
      { id: 'first-check-in', label: 'First check-in', achieved: qualifying.length > 0 },
      { id: 'first-photo-published', label: 'First photo published', achieved: qualifying.some((entry) => entry.isPublic === true) },
      { id: 'first-guided-look', label: 'First guided look', achieved: firstTourBadge === 'first_light' },
      // Community attendance has no honest source row yet, so it stays visible
      // as a future milestone rather than being inferred from a normal night.
      { id: 'first-community-night', label: 'First community night', achieved: false },
    ],
  }
}

/**
 * One-line toast copy for a save, from projector summaries taken either side
 * of it. Pending-review entries are excluded by the projector, so their delta
 * is 0 by construction; `pendingReview` only picks the explanation.
 *
 * "Next" is the first open milestone a check-in can unlock. Trip and community
 * milestones are skipped: callers snapshot without the PocketBase trip read,
 * and community has no source row yet.
 */
export function describeAward(
  before: ProgressSummary,
  after: ProgressSummary,
  { pendingReview = false, label = 'Session logged' }: { pendingReview?: boolean; label?: string } = {},
): string {
  const earned = after.totalPoints - before.totalPoints
  if (pendingReview) return 'Sent for review — 0 pts now; the night counts once approved.'
  const next = after.milestones.find((milestone) => !milestone.achieved && milestone.id !== 'first-trip' && milestone.id !== 'first-community-night')
  const nextCopy = next ? ` Next: ${next.label}.` : ''
  if (earned <= 0) return `${label} — that night already counted.${nextCopy}`
  return `${label} · +${earned} pts.${nextCopy}`
}
