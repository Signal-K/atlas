// "Through your telescope tonight" (ASV-154).
//
// Total magnitude is a poor predictor of whether an extended object is worth
// the eyepiece time. A magnitude-8 galaxy spread over 20 arcminutes can be
// invisible where a magnitude-9 planetary nebula is obvious. So each object is
// rated on four things the observer can actually act on:
//
//   * surface brightness (mag per square arcminute, derived from magnitude and
//     size) against what the chosen gear can pull out of the sky,
//   * how high it gets inside the astronomical-dark window,
//   * how much Moonlight it has to compete with (illumination, separation, and
//     how much that class of object suffers from it),
//   * the margin by which it clears the gear's limits.
//
// Every number here is a documented heuristic, not a measurement; the ranking
// is pinned by golden tests (test/deep-sky-tonight.test.mjs).
import * as Astronomy from 'astronomy-engine'
import { MESSIER_OBJECTS, type MessierObject } from '../data/messierCatalog.ts'
import { getDarknessWindow } from './darknessWindow.ts'
import { zonedWallTimeToUtc } from './eventTiming.mjs'
import { azimuthToCompass } from './skyPosition.ts'

export type DeepSkyGear = 'eye' | 'binoculars' | 'small' | 'large'
// Colour doubles are not covered yet: the Messier set has no showpiece doubles
// (M40 is a famous disappointment), so they wait for the NGC/IC showpiece list.
export type DeepSkyClass = 'nebula' | 'dying-star' | 'cluster' | 'galaxy'

export interface GearProfile {
  id: DeepSkyGear
  label: string
  /** Faintest total magnitude reachable under a dark, Moonless sky. */
  limitMag: number
  /** Faintest mean surface brightness (mag/arcmin²) reachable the same way. */
  limitSurfaceBrightness: number
  /** How the gear is described next to the picker. */
  hint: string
}

export const DEEP_SKY_GEAR: GearProfile[] = [
  { id: 'eye', label: 'Naked eye', limitMag: 6, limitSurfaceBrightness: 13.2, hint: 'Dark-sky smudges only' },
  { id: 'binoculars', label: 'Binoculars', limitMag: 9.5, limitSurfaceBrightness: 14, hint: '7x50 to 10x50' },
  { id: 'small', label: 'Small scope (60–100 mm)', limitMag: 11.5, limitSurfaceBrightness: 14.8, hint: 'Refractor or small reflector' },
  { id: 'large', label: 'Large scope (130 mm+)', limitMag: 13.5, limitSurfaceBrightness: 15.6, hint: 'Dobsonian or big reflector' },
]

export interface CLASS_INFO_SHAPE {
  label: string
  plain: string
  /** Moonlight washes these out by this fraction of the full penalty. */
  moonSensitivity: number
}

export const DEEP_SKY_CLASS_INFO: Record<DeepSkyClass, CLASS_INFO_SHAPE> = {
  nebula: { label: 'Glowing clouds', plain: 'a cloud of gas lit by newborn stars', moonSensitivity: 1 },
  'dying-star': { label: 'Dying stars', plain: 'the glowing remains of a star that has shed its outer layers', moonSensitivity: 0.5 },
  cluster: { label: 'Star cities', plain: 'a crowd of stars bound together by gravity', moonSensitivity: 0.35 },
  galaxy: { label: 'Distant galaxies', plain: 'a whole galaxy of stars, millions of light-years away', moonSensitivity: 1 },
}

export function deepSkyClassFor(type: string): DeepSkyClass | null {
  const t = type.toLowerCase()
  if (t === 'planetary nebula' || t === 'supernova remnant') return 'dying-star'
  if (t.includes('nebula')) return 'nebula' // nebula, reflection nebula, cluster + nebula
  if (t.includes('cluster') || t === 'star association') return 'cluster'
  if (t === 'galaxy') return 'galaxy'
  return null
}

export interface DeepSkyPick {
  id: string
  name: string
  type: string
  deepSkyClass: DeepSkyClass
  classLabel: string
  constellation?: string
  magnitude: number
  surfaceBrightness: number
  /** Best moment inside the dark window, ISO. */
  bestAt: string
  altitudeDeg: number
  azimuthDeg: number
  compassLabel: string
  /** "high in the south-east"-style phrase for the best moment. */
  direction: string
  moonSeparationDeg: number | null
  /** Magnitudes of Moonlight washout this object suffers at its best moment. */
  moonPenalty: number
  /** 0-100. */
  rating: number
  howTo: string
}

export interface DeepSkyTonight {
  gear: DeepSkyGear
  /** Dark window used (ISO), or null when the sun never gets low enough. */
  window: { start: string; end: string } | null
  moon: { illuminationPct: number; phaseName: string }
  picks: DeepSkyPick[]
  summary: string
}

const SAMPLE_MINUTES = 20
const MIN_ALTITUDE_DEG = 25
export const DEFAULT_PICKS = 6
const MAX_PER_CLASS = 2
const MAX_MOON_PENALTY_MAG = 1.4

const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value))

export function surfaceBrightness(magnitude: number, angularSizeDeg: number): number {
  const arcmin = Math.max(angularSizeDeg * 60, 0.5)
  const areaArcmin2 = (Math.PI / 4) * arcmin * arcmin
  return magnitude + 2.5 * Math.log10(areaArcmin2)
}

function gearProfile(gear: DeepSkyGear): GearProfile {
  return DEEP_SKY_GEAR.find((g) => g.id === gear) ?? DEEP_SKY_GEAR[2]
}

function localParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') }
}

/**
 * Noon (UTC instant) of the calendar day the current "observing night" starts
 * on. Before 6am local we are still in the previous evening's night.
 */
function nightAnchor(now: Date, timeZone: string): Date {
  const { year, month, day, hour } = localParts(now, timeZone)
  const base = new Date(Date.UTC(year, month - 1, day - (hour < 6 ? 1 : 0)))
  return zonedWallTimeToUtc(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), 12, 0, timeZone)
}

function darkWindow(now: Date, lat: number, lon: number, timeZone: string): { start: Date; end: Date } {
  const anchor = nightAnchor(now, timeZone)
  const win = getDarknessWindow(lat, lon, anchor, new Date(anchor.getTime() + 36 * 3_600_000))
  const startIso = win.astronomicalDuskAt ?? win.civilDuskAt ?? win.sunsetAt
  const endIso = win.astronomicalDawnAt ?? win.civilDawnAt
  if (startIso && endIso && new Date(endIso) > new Date(startIso)) {
    return { start: new Date(startIso), end: new Date(endIso) }
  }
  // No usable twilight (high latitude near the solstice): use 8pm-4am local.
  const { year, month, day } = localParts(anchor, timeZone)
  const next = new Date(Date.UTC(year, month - 1, day + 1))
  return {
    start: zonedWallTimeToUtc(year, month, day, 20, 0, timeZone),
    end: zonedWallTimeToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 4, 0, timeZone),
  }
}

interface MoonSample {
  at: Date
  altitudeDeg: number
  raHours: number
  decDeg: number
  illumination: number
}

function moonSamples(times: Date[], observer: Astronomy.Observer): MoonSample[] {
  return times.map((at) => {
    const eq = Astronomy.Equator(Astronomy.Body.Moon, at, observer, true, true)
    const hor = Astronomy.Horizon(at, observer, eq.ra, eq.dec, 'normal')
    return {
      at,
      altitudeDeg: hor.altitude,
      raHours: eq.ra,
      decDeg: eq.dec,
      illumination: Astronomy.Illumination(Astronomy.Body.Moon, at).phase_fraction,
    }
  })
}

function angularSeparationDeg(ra1H: number, dec1: number, ra2H: number, dec2: number): number {
  const rad = Math.PI / 180
  const a1 = ra1H * 15 * rad
  const a2 = ra2H * 15 * rad
  const d1 = dec1 * rad
  const d2 = dec2 * rad
  const cos = Math.sin(d1) * Math.sin(d2) + Math.cos(d1) * Math.cos(d2) * Math.cos(a1 - a2)
  return Math.acos(clamp(cos, -1, 1)) / rad
}

function moonPenaltyMag(moon: MoonSample, separationDeg: number): number {
  if (moon.altitudeDeg <= 0) return 0
  const proximity = Math.max(0.15, 1 - separationDeg / 110)
  const height = Math.min(1, 0.4 + moon.altitudeDeg / 30)
  return MAX_MOON_PENALTY_MAG * moon.illumination * proximity * height
}

const CARDINAL_WORDS: Record<string, string> = {
  N: 'north', NE: 'north-east', E: 'east', SE: 'south-east', S: 'south', SW: 'south-west', W: 'west', NW: 'north-west',
}

function directionPhrase(altitudeDeg: number, compass: string): string {
  const height = altitudeDeg >= 60 ? 'almost overhead' : altitudeDeg >= 40 ? 'high' : 'fairly low'
  const dir = CARDINAL_WORDS[compass] ?? compass
  return altitudeDeg >= 60 ? `${height}, towards the ${dir}` : `${height} in the ${dir}`
}

function howTo(cls: DeepSkyClass, gear: DeepSkyGear, name: string): string {
  const scope = gear === 'large' || gear === 'small'
  switch (cls) {
    case 'nebula':
      return scope
        ? `Start at low power with the widest eyepiece. A nebula (UHC or OIII) filter makes ${name} stand out; let your eyes adapt for 15 minutes first.`
        : `Look for a faint, soft glow rather than a point. Keep the binoculars braced and wait for your eyes to adapt.`
    case 'dying-star':
      return scope
        ? `Find the spot at low power, then raise the magnification: the shell is small and takes it well. An OIII filter helps if you have one.`
        : `It looks like a slightly fuzzy star in binoculars; compare it with its neighbours to spot it.`
    case 'cluster':
      return scope
        ? `Use medium power. Globulars start to break into individual stars at 100x or more; open clusters look best at low power.`
        : `Binoculars show it as a sprinkle of stars or a hazy ball. Brace them and look slightly to one side.`
    case 'galaxy':
      return scope
        ? `Look from the darkest spot you have and use averted vision (look slightly to the side). Expect a pale oval glow, not a photo.`
        : `A faint, elongated smudge. Averted vision (looking slightly to the side) makes it stronger.`
  }
}

function ratingFor(args: {
  altitudeDeg: number
  magnitude: number
  surface: number
  angularSizeDeg: number
  gear: GearProfile
  penalty: number
}): { rating: number; reachable: boolean } {
  const { altitudeDeg, magnitude, surface, angularSizeDeg, gear, penalty } = args
  const effMag = gear.limitMag - 0.5 * penalty
  const effSurface = gear.limitSurfaceBrightness - penalty
  const reachable = magnitude <= effMag && surface <= effSurface
  const altScore = clamp((altitudeDeg - 15) / 50, 0, 1)
  const margin = Math.min(effMag - magnitude, (effSurface - surface) * 1.5)
  const marginScore = clamp(margin / 3, 0, 1)
  const sizeScore = clamp((angularSizeDeg * 60) / 4, 0.25, 1)
  const rating = Math.round(100 * (0.45 * altScore + 0.4 * marginScore + 0.15 * sizeScore))
  return { rating, reachable }
}

export interface DeepSkyTonightInput {
  now: Date
  lat: number
  lon: number
  timeZone?: string
  gear: DeepSkyGear
  limit?: number
}

export function buildDeepSkyTonight({ now, lat, lon, timeZone, gear, limit = DEFAULT_PICKS }: DeepSkyTonightInput): DeepSkyTonight {
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const profile = gearProfile(gear)
  const observer = new Astronomy.Observer(lat, lon, 0)

  const dark = darkWindow(now, lat, lon, zone)
  const from = Math.max(dark.start.getTime(), now.getTime())
  const start = new Date(from < dark.end.getTime() ? from : dark.start.getTime())
  const times: Date[] = []
  for (let t = start.getTime(); t <= dark.end.getTime(); t += SAMPLE_MINUTES * 60_000) times.push(new Date(t))
  if (times.length === 0) times.push(start)
  const moons = moonSamples(times, observer)

  const midMoon = moons[Math.floor(moons.length / 2)]
  const moonInfo = {
    illuminationPct: Math.round(midMoon.illumination * 100),
    phaseName: moonPhaseName(midMoon.at),
  }

  const scored: DeepSkyPick[] = []
  for (const obj of MESSIER_OBJECTS) {
    const cls = deepSkyClassFor(obj.type)
    if (!cls) continue
    const info = DEEP_SKY_CLASS_INFO[cls]
    const surface = surfaceBrightness(obj.magnitude, obj.angularSizeDeg)

    let best: { rating: number; sample: number; altitudeDeg: number; azimuthDeg: number; penalty: number; sep: number } | null = null
    for (let i = 0; i < times.length; i += 1) {
      const hor = Astronomy.Horizon(times[i], observer, obj.raHours, obj.decDeg, 'normal')
      if (hor.altitude < MIN_ALTITUDE_DEG) continue
      const sep = angularSeparationDeg(obj.raHours, obj.decDeg, moons[i].raHours, moons[i].decDeg)
      const penalty = moonPenaltyMag(moons[i], sep) * info.moonSensitivity
      const { rating, reachable } = ratingFor({
        altitudeDeg: hor.altitude,
        magnitude: obj.magnitude,
        surface,
        angularSizeDeg: obj.angularSizeDeg,
        gear: profile,
        penalty,
      })
      if (!reachable) continue
      if (!best || rating > best.rating) {
        best = { rating, sample: i, altitudeDeg: hor.altitude, azimuthDeg: hor.azimuth, penalty, sep }
      }
    }
    if (!best) continue

    const compass = azimuthToCompass(best.azimuthDeg)
    scored.push({
      id: obj.id,
      name: displayName(obj),
      type: obj.type,
      deepSkyClass: cls,
      classLabel: info.label,
      constellation: constellationOf(obj),
      magnitude: obj.magnitude,
      surfaceBrightness: Math.round(surface * 10) / 10,
      bestAt: times[best.sample].toISOString(),
      altitudeDeg: Math.round(best.altitudeDeg),
      azimuthDeg: Math.round(best.azimuthDeg),
      compassLabel: compass,
      direction: directionPhrase(best.altitudeDeg, compass),
      moonSeparationDeg: moons[best.sample].altitudeDeg > 0 ? Math.round(best.sep) : null,
      moonPenalty: Math.round(best.penalty * 100) / 100,
      rating: best.rating,
      howTo: howTo(cls, gear, displayName(obj)),
    })
  }

  scored.sort((a, b) => b.rating - a.rating || a.magnitude - b.magnitude)
  const picks = diversify(scored, limit)

  return {
    gear,
    window: { start: start.toISOString(), end: dark.end.toISOString() },
    moon: moonInfo,
    picks,
    summary: summaryFor(picks.length, profile, moonInfo),
  }
}

// Take the best-rated object of each class first, so a night of open clusters
// doesn't hide the nebula or the galaxy, then fill the remaining slots in
// rating order with at most MAX_PER_CLASS of any one class. Anything still
// unfilled comes from the rest, so a night with few classes still returns
// `limit` picks.
function diversify(sorted: DeepSkyPick[], limit: number): DeepSkyPick[] {
  const chosen: DeepSkyPick[] = []
  const counts = new Map<DeepSkyClass, number>()
  for (const pick of sorted) {
    if (chosen.length >= limit) break
    if (counts.has(pick.deepSkyClass)) continue
    counts.set(pick.deepSkyClass, 1)
    chosen.push(pick)
  }
  for (const pick of sorted) {
    if (chosen.length >= limit) break
    if (chosen.includes(pick)) continue
    const n = counts.get(pick.deepSkyClass) ?? 0
    if (n >= MAX_PER_CLASS) continue
    counts.set(pick.deepSkyClass, n + 1)
    chosen.push(pick)
  }
  for (const pick of sorted) {
    if (chosen.length >= limit) break
    if (!chosen.includes(pick)) chosen.push(pick)
  }
  return chosen.sort((a, b) => b.rating - a.rating || a.magnitude - b.magnitude)
}

function displayName(obj: MessierObject): string {
  const messier = obj.id.toUpperCase()
  return obj.name === messier || obj.name.toLowerCase() === obj.id ? messier : `${obj.name} (${messier})`
}

function constellationOf(obj: MessierObject): string | undefined {
  try {
    return Astronomy.Constellation(obj.raHours, obj.decDeg).name
  } catch {
    return undefined
  }
}

function moonPhaseName(date: Date): string {
  const angle = ((Astronomy.MoonPhase(date) % 360) + 360) % 360
  const names = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent']
  return names[Math.round(angle / 45) % 8]
}

function summaryFor(count: number, gear: GearProfile, moon: { illuminationPct: number; phaseName: string }): string {
  if (count === 0) return `Nothing rewarding for ${gear.label.toLowerCase()} tonight (${moon.phaseName.toLowerCase()}, ${moon.illuminationPct}% lit). Try a bigger instrument or a darker night.`
  const moonNote = moon.illuminationPct >= 60 ? ` The Moon is ${moon.illuminationPct}% lit, so picks favour objects that cope with moonlight.` : moon.illuminationPct <= 15 ? ' Dark Moon: a good night for faint objects.' : ''
  return `${count} rewarding target${count === 1 ? '' : 's'} for ${gear.label.toLowerCase()} tonight.${moonNote}`
}

const GEAR_KEY = 'atlas-deep-sky-gear'

export function isDeepSkyGear(value: unknown): value is DeepSkyGear {
  return value === 'eye' || value === 'binoculars' || value === 'small' || value === 'large'
}

/** Maps onboarding's equipment choice to the picker's default. */
export function defaultGearFromEquipment(choice: string | null): DeepSkyGear {
  if (choice === 'telescope') return 'small'
  if (choice === 'binoculars') return 'binoculars'
  return 'eye'
}

export function readStoredGear(): DeepSkyGear | null {
  try {
    const value = localStorage.getItem(GEAR_KEY)
    return isDeepSkyGear(value) ? value : null
  } catch {
    return null
  }
}

export function storeGear(gear: DeepSkyGear): void {
  try {
    localStorage.setItem(GEAR_KEY, gear)
  } catch {
    // Remembering the pick is a convenience; never block on it.
  }
}
