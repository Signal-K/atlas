// Builds a single, normalized "entry detail" view-model shared by the Hub,
// Visible Tonight, Events, and Plan screens (STS: Atlas Tonight & Feed
// Redesign) -- one detail page instead of Hub's inline expand and
// Events/Plan's bottom sheet drifting into different-looking screens.
import * as Astronomy from 'astronomy-engine'
import type { SkyEvent } from './db'
import type { DailyViewingAdvisory } from './weather'
import type { DarknessWindow } from './darknessWindow'
import type { HorizontalPosition } from './skyPosition'
import type { TargetDifficulty, TonightTarget } from './tonightTargets'
import { metaFor } from './tonightTargets'
import { getPrimarySkyMapObjectForEvent } from './skyMapLayers'
import { moonIlluminationPctAt } from './moonPhase'
import { GUIDE_KIND_IDS } from './eventCategories'
import { recipeKeyForEventKind, type RecipeKey } from './cameraRecipes'
import { buildEventGuide, type GuideStep } from './eventGuide'
import { KIND_LABELS } from '../widgets/EventRow'
import type { BrightStar } from '../data/brightStars'

export interface EntryDetailLocation {
  lat: number
  lon: number
  name: string
  timeZone?: string
}

export interface SuitabilityPill {
  label: string
  active: boolean
}

export interface EntryDetailSubject {
  kind: 'event' | 'star'
  id: string
  title: string
  isGuide: boolean
  subtitleLine: string
  bestTimeIso: string | null
  bestTimeLabel: string
  direction: { compassLabel: string; altitudeDeg: number } | null
  moonPct: number | null
  suitability: SuitabilityPill[]
  suitabilityNote: string
  why: string
  cloudNote: string
  recipeKey: RecipeKey | null
  darknessWindow: DarknessWindow
  markerPct: number
  sourceEvent?: SkyEvent
  // Per-observer step-by-step "how to see it" (eclipse phase times, meteor
  // shower peak/moon note, etc.) -- null for kinds buildEventGuide doesn't
  // cover, or when no location was available to compute it against.
  guideSteps: GuideStep[] | null
}

const DIFFICULTY_LABEL: Record<TargetDifficulty, string> = {
  easy: 'Easy',
  moderate: 'Moderate',
  hard: 'Hard',
}

// Kinds where a moving/brief target makes binoculars impractical even
// though naked-eye or a phone can still catch it.
const BINOCULARS_UNHELPFUL = new Set(['meteor_shower', 'fireball', 'solar_flare', 'iss_pass', 'satellite_flare'])

// Moon illumination is useful context for dark-sky targets and lunar events,
// but it is not a property of a planet such as Venus. Keep the detail facts
// about the target rather than showing the same generic moon number everywhere.
const MOON_RELEVANT_EVENT_KINDS = new Set(['moon_phase', 'eclipse', 'meteor_shower', 'fireball', 'deep_sky', 'asteroid_approach'])

export function formatTimeLabel(iso: string | null, timeZone?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone })
}

function markerPctFor(bestTimeIso: string | null, window: DarknessWindow): number {
  const start = window.astronomicalDuskAt ?? window.civilDuskAt
  const end = window.astronomicalDawnAt ?? window.civilDawnAt
  if (!bestTimeIso || !start || !end) return 50
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  const t = new Date(bestTimeIso).getTime()
  if (e <= s) return 50
  return Math.min(96, Math.max(4, ((t - s) / (e - s)) * 100))
}

export function cloudNoteFrom(advisory: DailyViewingAdvisory | null): string {
  if (!advisory) return 'Cloud forecast unavailable for this window — check the sky yourself before heading out.'
  const rain = advisory.precipitationChancePct != null ? ` · ${Math.round(advisory.precipitationChancePct)}% rain chance` : ''
  return `${Math.round(advisory.cloudCoverPct)}% cloud cover forecast${rain} for the viewing window.`
}

function eventSuitability(kind: string, phoneFriendly: boolean, nakedEyeVisible: boolean): SuitabilityPill[] {
  return [
    { label: 'Naked eye', active: nakedEyeVisible },
    { label: 'Binoculars', active: !BINOCULARS_UNHELPFUL.has(kind) },
    { label: 'Phone', active: phoneFriendly },
  ]
}

function eventSuitabilityNote(pills: SuitabilityPill[]): string {
  const phone = pills.find((pill) => pill.label === 'Phone')?.active
  const binoculars = pills.find((pill) => pill.label === 'Binoculars')?.active
  const nakedEye = pills.find((pill) => pill.label === 'Naked eye')?.active
  if (phone) return 'Bright enough for a handheld or tripod phone shot to pick out clearly.'
  if (binoculars) return 'Binoculars or a longer lens reveal it better than a phone alone will.'
  if (nakedEye) return 'Easy to find naked-eye, though a phone will struggle to resolve much detail.'
  return 'A challenging target — best attempted with a telescope and tracking.'
}

interface EventDetailInput {
  id: string
  kind: string
  title: string
  bestTimeIso: string
  direction: HorizontalPosition | null
  difficulty: TargetDifficulty
  phoneFriendly: boolean
  nakedEyeVisible: boolean
  why: string
  moonPct: number | null
  darknessWindow: DarknessWindow
  sourceEvent?: SkyEvent
  location?: EntryDetailLocation
}

export function buildEventDetail(input: EventDetailInput, advisory: DailyViewingAdvisory | null): EntryDetailSubject {
  const suitability = eventSuitability(input.kind, input.phoneFriendly, input.nakedEyeVisible)
  const guideSteps = input.sourceEvent && input.location ? buildEventGuide(input.sourceEvent, input.location) : null
  return {
    kind: 'event',
    id: input.id,
    title: input.title,
    isGuide: GUIDE_KIND_IDS.has(input.kind),
    subtitleLine: `${KIND_LABELS[input.kind] ?? input.kind} · ${DIFFICULTY_LABEL[input.difficulty]} · ${
      input.phoneFriendly ? 'phone-friendly' : input.nakedEyeVisible ? 'naked-eye' : 'needs optics'
    }`,
    bestTimeIso: input.bestTimeIso,
    bestTimeLabel: formatTimeLabel(input.bestTimeIso),
    direction: input.direction ? { compassLabel: input.direction.compassLabel, altitudeDeg: input.direction.altitudeDeg } : null,
    moonPct: input.moonPct,
    suitability,
    suitabilityNote: eventSuitabilityNote(suitability),
    why: input.why,
    cloudNote: cloudNoteFrom(advisory),
    recipeKey: recipeKeyForEventKind(input.kind),
    darknessWindow: input.darknessWindow,
    markerPct: markerPctFor(input.bestTimeIso, input.darknessWindow),
    sourceEvent: input.sourceEvent,
    guideSteps,
  }
}

// Tonight's plan already resolved a real transit-aware best time + direction
// for this target -- the richest source available, used by Hub and Visible
// Tonight.
export function detailInputFromTonightTarget(
  target: TonightTarget,
  moonIlluminationPct: number,
  darknessWindow: DarknessWindow,
  sourceEvent?: SkyEvent,
  location?: EntryDetailLocation,
): EventDetailInput {
  return {
    id: target.eventId,
    kind: target.kind,
    title: target.title,
    bestTimeIso: target.bestTime,
    direction: target.direction,
    difficulty: target.difficulty,
    phoneFriendly: target.phoneFriendly,
    nakedEyeVisible: target.nakedEyeVisible,
    why: `${target.reason} ${target.viewingNote}`,
    moonPct: moonIlluminationPct,
    darknessWindow,
    sourceEvent,
    location,
  }
}

// Fallback for events outside tonight's window (a future date browsed from
// Events/Plan) -- reuses the same kind metadata tonight's ranker uses, just
// anchored to the event's own start time instead of a transit search.
export function detailInputFromEvent(event: SkyEvent, location: EntryDetailLocation, darknessWindow: DarknessWindow): EventDetailInput {
  const meta = metaFor(event.kind)
  const bestTime = new Date(event.startsAt)
  const primary = getPrimarySkyMapObjectForEvent(event, bestTime, location.lat, location.lon)
  return {
    id: event.id,
    kind: event.kind,
    title: event.title,
    bestTimeIso: bestTime.toISOString(),
    direction: primary ? { altitudeDeg: primary.altitudeDeg, azimuthDeg: primary.azimuthDeg, compassLabel: primary.compassLabel } : null,
    difficulty: meta.difficulty,
    phoneFriendly: meta.phoneFriendly,
    nakedEyeVisible: meta.nakedEyeVisible,
    why: event.content || event.description || meta.reason,
    moonPct: MOON_RELEVANT_EVENT_KINDS.has(event.kind) ? moonIlluminationPctAt(bestTime) : null,
    darknessWindow,
    sourceEvent: event,
    location,
  }
}

// --- Stars -----------------------------------------------------------

export function colorLabelForBv(bv: number): string {
  if (bv < -0.1) return 'blue-white'
  if (bv < 0.3) return 'white'
  if (bv < 0.6) return 'yellow-white'
  if (bv < 1.0) return 'yellow-orange'
  if (bv < 1.6) return 'orange'
  return 'deep red'
}

// Next transit (highest point, due local meridian) at/after `from`, via the
// local-sidereal-time hour-angle formula -- avoids astronomy-engine's
// SearchHourAngle, which only resolves named Bodies, not arbitrary
// catalogue RA/Dec.
export function starTransitTime(raHours: number, lon: number, from: Date): Date {
  const gst = Astronomy.SiderealTime(from)
  const lst = (gst + lon / 15 + 24) % 24
  const deltaSiderealHours = (raHours - lst + 24) % 24
  const deltaSolarHours = deltaSiderealHours / 1.0027379
  return new Date(from.getTime() + deltaSolarHours * 3_600_000)
}

function starSuitability(magnitude: number): SuitabilityPill[] {
  return [
    { label: 'Naked eye', active: true },
    { label: 'Binoculars', active: true },
    { label: 'Phone', active: magnitude <= 1.0 },
  ]
}

function starSuitabilityNote(magnitude: number, colorLabel: string): string {
  if (magnitude <= 1.0) return `Bright enough for a steady tripod shot to pick out its ${colorLabel} tone.`
  return `Binoculars or a long lens reveal the ${colorLabel} color more clearly than a phone can at this brightness.`
}

export function buildStarDetail(
  star: BrightStar,
  position: { altitudeDeg: number; azimuthDeg: number; compassLabel: string; constellation?: string },
  moonPct: number,
  darknessWindow: DarknessWindow,
  lon: number,
  advisory: DailyViewingAdvisory | null,
): EntryDetailSubject {
  const bv = star.colorIndex ?? 0
  const colorLabel = colorLabelForBv(bv)
  const from = darknessWindow.astronomicalDuskAt ? new Date(darknessWindow.astronomicalDuskAt) : new Date()
  const bestTime = starTransitTime(star.raHours, lon, from)
  const suitability = starSuitability(star.magnitude)
  return {
    kind: 'star',
    id: star.id,
    title: star.name,
    isGuide: false,
    subtitleLine: `${position.constellation ? position.constellation + ' · ' : ''}mag ${star.magnitude.toFixed(2)} · ${colorLabel}`,
    bestTimeIso: bestTime.toISOString(),
    bestTimeLabel: formatTimeLabel(bestTime.toISOString()),
    direction: { compassLabel: position.compassLabel, altitudeDeg: position.altitudeDeg },
    moonPct,
    suitability,
    suitabilityNote: starSuitabilityNote(star.magnitude, colorLabel),
    why: `${star.name} is one of the brightest stars visible tonight (magnitude ${star.magnitude.toFixed(2)}) — its ${colorLabel} tint is visible to the naked eye once your eyes adjust to the dark.`,
    cloudNote: cloudNoteFrom(advisory),
    recipeKey: null,
    darknessWindow,
    markerPct: markerPctFor(bestTime.toISOString(), darknessWindow),
    guideSteps: null,
  }
}
