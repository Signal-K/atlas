// The onboarding contract, shared by the flow itself (components/
// OnboardingFlow.tsx), the gate that decides whether to show it
// (providers/useOnboardingGate.ts) and the account sync (lib/auth.ts).
//
// This lives outside the component because those three have to agree: the
// gate compares against ONBOARDING_VERSION, the flow stamps it on completion,
// and the account sync persists it. A constant imported from a component file
// would also drag the component (and everything it imports) into any caller
// that only wanted to read a flag.

// Bump this whenever the flow gains a question that existing accounts must
// answer too. The gate compares the *completed* version against it, so a bump
// walks every account back through the flow on its next launch -- which is
// what makes an overhaul apply to people who already onboarded once, rather
// than the old one-way boolean exempting them forever.
//
// v1: the original four steps (name / interests / location / notifications).
// v2: adds equipment, experience and club questions, and re-runs the flow for
//     everyone (ASV-53).
export const ONBOARDING_VERSION = 2

export const ONBOARDING_FLOW_KEY = 'atlas-onboarding-flow-complete'
export const ONBOARDING_REQUIRED_KEY = 'atlas-onboarding-flow-required'

// Every access below is wrapped. localStorage throws outright in Safari private
// mode, under storage pressure, and in some managed browser profiles -- and
// markOnboardingComplete() runs inside the flow's finish(), *before* the
// overlay is dismissed. An uncaught throw there leaves the user staring at an
// eight-step flow that cannot be closed, on the first launch after this change
// ships, for every user -- because the version bump deliberately puts everyone
// through it. Degrading to "not complete" is recoverable; throwing is not.
function readVersion(key: string): number {
  try {
    const parsed = Number(localStorage.getItem(key))
    return Number.isFinite(parsed) ? parsed : 0
  } catch {
    return 0
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // See above: never let storage failure break the flow.
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // See above.
  }
}

// The version of the flow this browser last completed; 0 if never.
//
// Old installs stored the literal '1' to mean "done" -- which reads here as
// "completed version 1", exactly the right meaning, so nobody who finished the
// four-step flow is treated as never having onboarded. Malformed values coerce
// to 0 as well (Number('garbage') is NaN), which fails toward showing the flow
// rather than hiding it.
export function completedOnboardingVersion(): number {
  return readVersion(ONBOARDING_FLOW_KEY)
}

export function hasCompletedOnboardingFlow(): boolean {
  return completedOnboardingVersion() >= ONBOARDING_VERSION
}

export function requiresOnboardingFlow(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_REQUIRED_KEY) === '1'
  } catch {
    return false
  }
}

// Clears the completed version, not just a boolean -- otherwise an interrupted
// re-run would leave the old (satisfying) version on disk and the gate would
// wave the user straight past the flow on the next load.
export function markOnboardingRequired(): void {
  remove(ONBOARDING_FLOW_KEY)
  write(ONBOARDING_REQUIRED_KEY, '1')
}

export function markOnboardingComplete(): void {
  write(ONBOARDING_FLOW_KEY, String(ONBOARDING_VERSION))
  remove(ONBOARDING_REQUIRED_KEY)
}

export type ExperienceLevel = 'beginner' | 'casual' | 'experienced' | 'expert'

// A coarse self-assessment, not a skill test: it only decides how much
// explaining the app does, so four buckets with plain-language descriptions
// beat a finer scale nobody would answer consistently.
export const EXPERIENCE_LEVELS: { id: ExperienceLevel; label: string; hint: string }[] = [
  { id: 'beginner', label: 'Just starting out', hint: 'I couldn’t name a constellation yet.' },
  { id: 'casual', label: 'I look up now and then', hint: 'I know a few of the bright ones.' },
  { id: 'experienced', label: 'I observe regularly', hint: 'I plan sessions and know my way around.' },
  { id: 'expert', label: 'Years of it', hint: 'I image, or I know the sky cold.' },
]

export interface OnboardingAnswers {
  // VIEWING_INSTRUMENTS ids from lib/tripPlans.ts -- the same vocabulary the
  // itinerary builder and Profile settings already write, so an answer given
  // here is immediately usable by those filters.
  viewingInstruments: string[]
  experienceLevel: ExperienceLevel | null
  inAstroClub: boolean
  astroClubName: string
}

const ANSWERS_KEY = 'atlas-onboarding-answers'

function emptyAnswers(): OnboardingAnswers {
  return { viewingInstruments: [], experienceLevel: null, inAstroClub: false, astroClubName: '' }
}

function isExperienceLevel(value: unknown): value is ExperienceLevel {
  return EXPERIENCE_LEVELS.some((level) => level.id === value)
}

// Staged answers for a visitor who hasn't got an account yet -- guests
// complete onboarding before they sign up (see useOnboardingGate's
// handleSignedUp), and the three new questions have no existing local store of
// their own the way a name or a favourite does. lib/auth.ts's
// syncOnboardingToAccount() reads this back and pushes it onto the account.
export function getOnboardingAnswers(): OnboardingAnswers {
  try {
    const raw = localStorage.getItem(ANSWERS_KEY)
    if (!raw) return emptyAnswers()
    const parsed = JSON.parse(raw) as Partial<OnboardingAnswers>
    return {
      viewingInstruments: Array.isArray(parsed.viewingInstruments)
        ? parsed.viewingInstruments.filter((id): id is string => typeof id === 'string')
        : [],
      experienceLevel: isExperienceLevel(parsed.experienceLevel) ? parsed.experienceLevel : null,
      inAstroClub: parsed.inAstroClub === true,
      astroClubName: typeof parsed.astroClubName === 'string' ? parsed.astroClubName : '',
    }
  } catch {
    return emptyAnswers()
  }
}

export function saveOnboardingAnswers(patch: Partial<OnboardingAnswers>): OnboardingAnswers {
  const next = { ...getOnboardingAnswers(), ...patch }
  try {
    localStorage.setItem(ANSWERS_KEY, JSON.stringify(next))
  } catch {
    // Best-effort, same as geo.ts's cache write -- a failed write just means
    // the answer is only held in React state until the flow is finished.
  }
  return next
}

export function clearOnboardingAnswers(): void {
  try {
    localStorage.removeItem(ANSWERS_KEY)
  } catch {
    // See saveOnboardingAnswers.
  }
}
