import type { ObservationLogEntry } from './db'
import type { TripPlan } from './tripPlans'
import type { ExperienceLevel } from './onboarding'
import { EVENT_CATEGORIES, GUIDE_KIND_IDS, categoryForKind } from './eventCategories.ts'
import { countsTowardProgress } from './progress.ts'

// ASV-89. A short, personal habit path: three steps picked from what the person
// told Atlas (experience, event interests, survey chips). Completion is never
// stored -- it is re-derived from the same rows the progress projector reads,
// so a matching check-in ticks a step with no completion table.

export type PathCriterion =
  | { type: 'check-in' }
  | { type: 'category'; categoryId: string }
  | { type: 'photo' }
  | { type: 'published' }
  | { type: 'trip' }
  | { type: 'tour' }

export interface PathStepTemplate {
  id: string
  title: string
  detail: string
  criterion: PathCriterion
}

export interface PathStep extends PathStepTemplate {
  done: boolean
}

export interface PathProfile {
  experienceLevel: ExperienceLevel | null
  // Event kinds from the interests picker.
  interestKinds: readonly string[]
  // Verbatim ONBOARDING_SURVEY_CHOICES strings.
  purposeChips: readonly string[]
}

const DEFAULT_CATEGORY_ID = 'planets'

function primaryCategory(interestKinds: readonly string[]) {
  const wanted = EVENT_CATEGORIES.find(
    (category) => category.id !== 'guides' && category.kinds.some((kind) => interestKinds.includes(kind)),
  )
  return wanted ?? EVENT_CATEGORIES.find((category) => category.id === DEFAULT_CATEGORY_ID)!
}

// First matching chip wins, in the order a person is most likely to have picked
// for a concrete next action. Chip text is the contract with
// ONBOARDING_SURVEY_CHOICES (onboardingSurvey.ts, not importable from node tests).
const CHIP_STEPS: { chip: string; step: PathStepTemplate }[] = [
  {
    chip: 'Planning sessions with my telescope',
    step: { id: 'plan-trip', title: 'Plan a viewing trip', detail: 'Save a trip in the Planner so Atlas can line up your sessions.', criterion: { type: 'trip' } },
  },
  {
    chip: 'Photographing the sky',
    step: { id: 'attach-photo', title: 'Attach a photo to a check-in', detail: 'Open the camera recipe for your target, then log the shot.', criterion: { type: 'photo' } },
  },
  {
    chip: 'Sharing the sky with others',
    step: { id: 'publish-photo', title: 'Publish a photo', detail: 'Share one of your check-in photos publicly.', criterion: { type: 'published' } },
  },
  {
    chip: 'Learning the sky as a beginner',
    step: { id: 'first-light', title: 'Take the First light tour', detail: 'A guided first look at tonight’s sky.', criterion: { type: 'tour' } },
  },
]

const DEFAULT_THIRD: PathStepTemplate = {
  id: 'attach-photo',
  title: 'Attach a photo to a check-in',
  detail: 'A photo turns a night out into something you can look back on.',
  criterion: { type: 'photo' },
}

export function buildTrainingPath({ experienceLevel, interestKinds, purposeChips }: PathProfile): PathStepTemplate[] {
  const category = primaryCategory(interestKinds)
  const newcomer = experienceLevel === null || experienceLevel === 'beginner' || experienceLevel === 'casual'

  const first: PathStepTemplate = newcomer
    ? { id: 'first-night', title: 'Log a night outside', detail: 'Go out tonight and log what you saw.', criterion: { type: 'check-in' } }
    : { id: 'regular-night', title: 'Log tonight’s session', detail: 'Keep the habit going with one more check-in.', criterion: { type: 'check-in' } }

  const second: PathStepTemplate = {
    id: `category-${category.id}`,
    title: `Check in on ${category.label.toLowerCase()}`,
    detail: `Log a sighting from ${category.label}.`,
    criterion: { type: 'category', categoryId: category.id },
  }

  const third = CHIP_STEPS.find((entry) => purposeChips.includes(entry.chip))?.step ?? DEFAULT_THIRD

  const steps = [first, second, third]
  // A path of near-identical steps is just noise.
  return steps.filter((step, index) => steps.findIndex((other) => other.id === step.id) === index)
}

export interface PathEvidence {
  observations: readonly ObservationLogEntry[]
  tripPlan?: TripPlan | null
  firstTourBadge?: 'first_light' | null
  // Entry id -> sky-event kind (see progressSnapshot.resolveSightingKinds).
  sightingKinds?: Readonly<Record<string, string>>
}

export function isStepDone(criterion: PathCriterion, { observations, tripPlan = null, firstTourBadge = null, sightingKinds = {} }: PathEvidence): boolean {
  const qualifying = observations.filter(countsTowardProgress)
  switch (criterion.type) {
    case 'check-in':
      return qualifying.length > 0
    case 'category':
      return qualifying.some((entry) => {
        const kind = sightingKinds[entry.id]
        return kind !== undefined && !GUIDE_KIND_IDS.has(kind) && categoryForKind(kind)?.id === criterion.categoryId
      })
    case 'photo':
      return qualifying.some((entry) => Boolean(entry.photo || entry.photoR2Key))
    case 'published':
      return qualifying.some((entry) => entry.isPublic === true)
    case 'trip':
      return tripPlan !== null
    case 'tour':
      return firstTourBadge === 'first_light'
  }
}

export function evaluateTrainingPath(templates: readonly PathStepTemplate[], evidence: PathEvidence): PathStep[] {
  return templates.map((template) => ({ ...template, done: isStepDone(template.criterion, evidence) }))
}

export function nextPathStep(steps: readonly PathStep[]): PathStep | null {
  return steps.find((step) => !step.done) ?? null
}
