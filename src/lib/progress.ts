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

export type ProgressAction =
  | 'observing_night'
  | 'typed_sighting'
  | 'photo_logged'
  | 'photo_published'
  | 'advice_followed'
  | 'trip_planned'
  | 'trip_leg'
  | 'first_tour'
  | 'community_night'

export interface ProgressAward {
  action: ProgressAction
  // Stable identity of what earned the points (a date, an entry id, a plan or
  // leg id), so the same award can never be recorded twice.
  sourceId: string
  skill: ProgressSkill
  points: number
  eventKind?: string
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
  // Every point as one row keyed by (action, sourceId). The XP ledger stores
  // exactly these, so ledger totals equal the projector by construction.
  awards: ProgressAward[]
  milestones: ProgressMilestone[]
}

// A camera recipe the person opened for a target (see recipeOpens.ts).
export interface RecipeOpen {
  recipeKey: string
  target: string
  openedAt: string
}

export const ADVICE_FOLLOWED_POINTS = 12

export interface ProgressInput {
  observations: readonly ObservationLogEntry[]
  // A TripPlan is a PocketBase-backed plan. Local draft/localStorage trips
  // deliberately never reach this projector, so they cannot grant points.
  tripPlan?: TripPlan | null
  firstTourBadge?: 'first_light' | null
  // Entry id -> sky-event kind, resolved by the caller (skyEvents join, recipe
  // fallback). Kept as input so this module stays free of Dexie and recipes.
  sightingKinds?: Readonly<Record<string, string>>
  recipeOpens?: readonly RecipeOpen[]
}

export const TYPED_SIGHTING_POINTS = 5
export const COMMUNITY_NIGHT_POINTS = 25

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

function followedRecipeAdvice(entry: ObservationLogEntry, opens: readonly RecipeOpen[]): boolean {
  if (!entry.cameraRecipeUsed || !entry.targetName) return false
  const target = entry.targetName.trim().toLowerCase()
  const loggedAt = Date.parse(entry.observedAt)
  // The advice has to be opened before the attempt it is credited to.
  return opens.some(
    (open) =>
      open.recipeKey === entry.cameraRecipeUsed &&
      open.target.trim().toLowerCase() === target &&
      Date.parse(open.openedAt) <= loggedAt,
  )
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
export function projectProgress({ observations, tripPlan = null, firstTourBadge = null, sightingKinds = {}, recipeOpens = [] }: ProgressInput): ProgressSummary {
  const awards: ProgressAward[] = []
  // A self-reported sky night is community attendance, not a sighting: it must
  // not also read as a check-in, a night out or a photo.
  const counted = observations.filter(countsTowardProgress)
  const communityNights = new Set(counted.filter((entry) => entry.communityNightHost).map((entry) => civilDate(entry.observedAt)))
  const qualifying = counted.filter((entry) => !entry.communityNightHost)
  for (const date of [...communityNights].sort()) {
    awards.push({ action: 'community_night', sourceId: date, skill: 'community', points: COMMUNITY_NIGHT_POINTS })
  }

  // A night is the atomic observing action. Multiple check-ins during it may
  // prove separate photos, but never turn into multiple "went outside" awards.
  const nights = new Set(qualifying.map((entry) => civilDate(entry.observedAt)))
  for (const date of [...nights].sort()) {
    awards.push({ action: 'observing_night', sourceId: date, skill: 'observing', points: 10 })
  }

  for (const entry of qualifying) {
    const kind = sightingKinds[entry.id]
    if (isTypedSightingKind(kind)) {
      awards.push({ action: 'typed_sighting', sourceId: entry.id, skill: 'observing', points: TYPED_SIGHTING_POINTS, eventKind: kind })
    }
    if (hasPhoto(entry)) awards.push({ action: 'photo_logged', sourceId: entry.id, skill: 'photography', points: 8 })
    if (entry.isPublic === true) awards.push({ action: 'photo_published', sourceId: entry.id, skill: 'photography', points: 15 })
    if (followedRecipeAdvice(entry, recipeOpens)) awards.push({ action: 'advice_followed', sourceId: entry.id, skill: 'photography', points: ADVICE_FOLLOWED_POINTS })
  }

  if (tripPlan) {
    awards.push({ action: 'trip_planned', sourceId: tripPlan.id, skill: 'planning', points: 20 })
    // Legs after the first are extra stops; keyed by leg id so each is paid once.
    for (const leg of tripPlan.legs.slice(1)) {
      awards.push({ action: 'trip_leg', sourceId: leg.id, skill: 'planning', points: 5 })
    }
  }
  if (firstTourBadge === 'first_light') awards.push({ action: 'first_tour', sourceId: 'first_light', skill: 'planning', points: 15 })

  const skills: Record<ProgressSkill, number> = { observing: 0, photography: 0, planning: 0, community: 0 }
  const observingByKind: Record<string, number> = {}
  for (const award of awards) {
    skills[award.skill] += award.points
    if (award.eventKind) observingByKind[award.eventKind] = (observingByKind[award.eventKind] ?? 0) + award.points
  }

  const totalPoints = Object.values(skills).reduce((total, points) => total + points, 0)
  const { level, nextLevelAt } = levelFor(totalPoints)

  return {
    totalPoints,
    level,
    nextLevelAt,
    pointsToNextLevel: nextLevelAt === null ? 0 : Math.max(0, nextLevelAt - totalPoints),
    skills,
    observingByKind,
    awards,
    milestones: [
      { id: 'first-trip', label: 'First trip planned', achieved: tripPlan !== null },
      { id: 'first-check-in', label: 'First check-in', achieved: qualifying.length > 0 },
      { id: 'first-photo-published', label: 'First photo published', achieved: qualifying.some((entry) => entry.isPublic === true) },
      { id: 'first-guided-look', label: 'First guided look', achieved: firstTourBadge === 'first_light' },
      // Only the explicit "I went to a sky night" action counts; a normal
      // night, the First light tour or a host mailto never does.
      { id: 'first-community-night', label: 'First community night', achieved: communityNights.size > 0 },
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

export interface ProgressAnalyticsEvent {
  name: 'Progress awarded' | 'Milestone unlocked'
  properties: Record<string, string | number>
}

/**
 * PostHog events for a save, from summaries either side of it. One
 * `Progress awarded` per skill that gained points (with the sky-event kind
 * that earned the observing bonus, when there is one) and one
 * `Milestone unlocked` per newly achieved milestone.
 */
export function progressAnalyticsEvents(before: ProgressSummary, after: ProgressSummary, action: string): ProgressAnalyticsEvent[] {
  const events: ProgressAnalyticsEvent[] = []
  for (const skill of PROGRESS_SKILLS) {
    const points = after.skills[skill] - before.skills[skill]
    if (points <= 0) continue
    const eventKind = skill === 'observing'
      ? Object.keys(after.observingByKind).find((kind) => (after.observingByKind[kind] ?? 0) > (before.observingByKind[kind] ?? 0))
      : undefined
    events.push({ name: 'Progress awarded', properties: { action, skill, points, ...(eventKind ? { event_kind: eventKind } : {}) } })
  }
  for (const milestone of after.milestones) {
    const was = before.milestones.find((m) => m.id === milestone.id)
    if (milestone.achieved && !was?.achieved) events.push({ name: 'Milestone unlocked', properties: { milestone: milestone.id } })
  }
  return events
}
