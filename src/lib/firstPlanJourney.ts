import type { TonightTarget } from './tonightTargets'

export type EquipmentChoice = 'eyes' | 'phone' | 'binoculars' | 'telescope'

export interface LocalTargetTap {
  targetId: string
  title: string
  kind: string
  tappedAt: string
  source: 'tonight' | 'mobile_hub'
  locationLabel: string
}

const TARGET_TAPS_KEY = 'atlas-first-plan-target-taps'
const EQUIPMENT_KEY = 'atlas-first-plan-equipment'
const EQUIPMENT_PROMPT_DISMISSED_KEY = 'atlas-first-plan-equipment-dismissed'

export const EQUIPMENT_OPTIONS: Array<{ id: EquipmentChoice; label: string }> = [
  { id: 'eyes', label: 'Just my eyes' },
  { id: 'phone', label: 'My phone' },
  { id: 'binoculars', label: 'Binoculars' },
  { id: 'telescope', label: 'A telescope' },
]

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Local journey data is best-effort; storage failure should not block the plan.
  }
}

export function listLocalTargetTaps(): LocalTargetTap[] {
  return readJson<LocalTargetTap[]>(TARGET_TAPS_KEY, [])
}

export function recordLocalTargetTap(target: TonightTarget, source: LocalTargetTap['source'], locationLabel: string) {
  const taps = listLocalTargetTaps()
  taps.push({
    targetId: target.eventId,
    title: target.title,
    kind: target.kind,
    tappedAt: new Date().toISOString(),
    source,
    locationLabel,
  })
  writeJson(TARGET_TAPS_KEY, taps.slice(-100))
  window.dispatchEvent(new Event('atlas:first-plan-local-data-changed'))
}

export function getEquipmentChoice(): EquipmentChoice | null {
  const value = localStorage.getItem(EQUIPMENT_KEY)
  return EQUIPMENT_OPTIONS.some((option) => option.id === value) ? (value as EquipmentChoice) : null
}

export function saveEquipmentChoice(choice: EquipmentChoice) {
  localStorage.setItem(EQUIPMENT_KEY, choice)
  localStorage.setItem(EQUIPMENT_PROMPT_DISMISSED_KEY, '1')
  window.dispatchEvent(new Event('atlas:first-plan-local-data-changed'))
}

export function dismissEquipmentPrompt() {
  localStorage.setItem(EQUIPMENT_PROMPT_DISMISSED_KEY, '1')
}

export function shouldAskForEquipment(): boolean {
  return listLocalTargetTaps().length > 0 && !getEquipmentChoice() && localStorage.getItem(EQUIPMENT_PROMPT_DISMISSED_KEY) !== '1'
}

type EquipmentRankable = Pick<TonightTarget, 'phoneFriendly' | 'nakedEyeVisible' | 'difficulty'>

function matchesEquipment(target: EquipmentRankable, equipment: EquipmentChoice): boolean {
  if (equipment === 'eyes') return target.nakedEyeVisible
  if (equipment === 'phone') return target.phoneFriendly
  if (equipment === 'binoculars') return target.difficulty !== 'hard'
  return true // a telescope can handle anything on the list
}

// Reorders targets so ones that suit the user's stated equipment come first,
// without changing relative order within each group -- lets someone with
// "just my eyes" see naked-eye targets before phone/binocular/telescope-only
// ones, instead of equipment being collected but never acted on.
export function sortTargetsByEquipment<T extends EquipmentRankable>(targets: T[], equipment: EquipmentChoice | null): T[] {
  if (!equipment) return targets
  return targets
    .map((target, index) => ({ target, index, matches: matchesEquipment(target, equipment) ? 0 : 1 }))
    .sort((a, b) => a.matches - b.matches || a.index - b.index)
    .map(({ target }) => target)
}

export function equipmentFitNote(target: EquipmentRankable, equipment: EquipmentChoice | null): string | null {
  if (!equipment) return null
  if (equipment === 'eyes') {
    return target.nakedEyeVisible ? 'Good match for eyes only.' : 'You may need binoculars or a telescope to see this well.'
  }
  if (equipment === 'phone') {
    return target.phoneFriendly ? 'Good match for a phone camera.' : 'Tough to capture with just a phone.'
  }
  if (equipment === 'binoculars') {
    return target.difficulty === 'hard' ? 'A telescope will show more than binoculars here.' : 'Binoculars should work well for this.'
  }
  return 'Your telescope can handle this one.'
}

export function describeWhatYouWouldSee(target: TonightTarget): string {
  if (target.kind === 'iss_pass' || target.kind === 'satellite_flare') {
    return 'You would see a bright point moving steadily across the sky for a few minutes.'
  }
  if (target.kind === 'deep_sky') {
    return target.nakedEyeVisible
      ? 'You would see a faint smudge or patch in a dark sky.'
      : 'You would likely need binoculars or a telescope to see more than a faint patch.'
  }
  if (target.kind === 'meteor_shower') {
    return 'You would wait under a dark sky for quick streaks of light, one at a time.'
  }
  if (target.kind === 'moon_phase' || target.kind === 'eclipse') {
    return 'You would see the Moon clearly, with shape, shadow, or surface detail visible by eye.'
  }
  if (target.kind === 'planet_event' || target.kind === 'conjunction') {
    return 'You would see one or more bright star-like points; binoculars may reveal nearby moons or separation.'
  }
  return target.nakedEyeVisible ? 'You would see it with your eyes as a bright or distinct sky feature.' : 'You would need optical help to see it well.'
}
