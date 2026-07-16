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
