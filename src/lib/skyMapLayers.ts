import * as Astronomy from 'astronomy-engine'
import { BRIGHT_STARS } from '../data/brightStars'
import { azimuthToCompass, getHorizontalPosition } from './skyPosition'
import type { SkyEvent } from './db'

export type SkyMapObjectKind = 'star' | 'planet' | 'moon' | 'sun' | 'deep_sky'

export interface SkyMapObject {
  id: string
  kind: SkyMapObjectKind
  name: string
  altitudeDeg: number
  azimuthDeg: number
  compassLabel: string
  visible: boolean
  magnitude?: number
  phaseFraction?: number
  phaseLabel?: string
  angularSizeDeg?: number
  constellation?: string
  objectType?: string
  sourceLabel?: string
  sourceUrl?: string
}

interface DeepSkyTarget {
  id: string
  name: string
  type: string
  raHours: number
  decDeg: number
  magnitude: number
  angularSizeDeg: number
}

const PLANET_BODIES: Array<{ id: string; name: string; body: Astronomy.Body }> = [
  { id: 'mercury', name: 'Mercury', body: Astronomy.Body.Mercury },
  { id: 'venus', name: 'Venus', body: Astronomy.Body.Venus },
  { id: 'mars', name: 'Mars', body: Astronomy.Body.Mars },
  { id: 'jupiter', name: 'Jupiter', body: Astronomy.Body.Jupiter },
  { id: 'saturn', name: 'Saturn', body: Astronomy.Body.Saturn },
  { id: 'uranus', name: 'Uranus', body: Astronomy.Body.Uranus },
  { id: 'neptune', name: 'Neptune', body: Astronomy.Body.Neptune },
]

const SOLAR_SYSTEM_BODIES = new Map<string, { name: string; kind: SkyMapObjectKind; body: Astronomy.Body }>([
  ['sun', { name: 'Sun', kind: 'sun', body: Astronomy.Body.Sun }],
  ['moon', { name: 'Moon', kind: 'moon', body: Astronomy.Body.Moon }],
  ...PLANET_BODIES.map(({ id, name, body }) => [id, { name, kind: 'planet' as const, body }] as const),
])

const SOLAR_SYSTEM_SOURCE_URLS: Record<string, string> = {
  sun: 'https://science.nasa.gov/sun/',
  moon: 'https://science.nasa.gov/moon/',
  mercury: 'https://science.nasa.gov/mercury/',
  venus: 'https://science.nasa.gov/venus/',
  mars: 'https://science.nasa.gov/mars/',
  jupiter: 'https://science.nasa.gov/jupiter/',
  saturn: 'https://science.nasa.gov/saturn/',
  uranus: 'https://science.nasa.gov/uranus/',
  neptune: 'https://science.nasa.gov/neptune/',
}

function simbadUrl(name: string): string {
  return `https://simbad.u-strasbg.fr/simbad/sim-id?Ident=${encodeURIComponent(name)}`
}

// Small bundled seed list for the first real map layer. These are deliberately
// bright/showpiece targets; a generated catalog can replace this without
// changing the SkyMapObject API.
export const DEEP_SKY_TARGETS: DeepSkyTarget[] = [
  { id: 'm31', name: 'Andromeda Galaxy', type: 'galaxy', raHours: 0.712, decDeg: 41.269, magnitude: 3.4, angularSizeDeg: 3.1 },
  { id: 'm42', name: 'Orion Nebula', type: 'nebula', raHours: 5.588, decDeg: -5.391, magnitude: 4.0, angularSizeDeg: 1.1 },
  { id: 'm45', name: 'Pleiades', type: 'open cluster', raHours: 3.792, decDeg: 24.117, magnitude: 1.6, angularSizeDeg: 1.8 },
  { id: 'm44', name: 'Beehive Cluster', type: 'open cluster', raHours: 8.672, decDeg: 19.672, magnitude: 3.7, angularSizeDeg: 1.6 },
  { id: 'm8', name: 'Lagoon Nebula', type: 'nebula', raHours: 18.061, decDeg: -24.386, magnitude: 6.0, angularSizeDeg: 1.5 },
  { id: 'm20', name: 'Trifid Nebula', type: 'nebula', raHours: 18.041, decDeg: -23.029, magnitude: 6.3, angularSizeDeg: 0.5 },
  { id: 'm57', name: 'Ring Nebula', type: 'planetary nebula', raHours: 18.894, decDeg: 33.029, magnitude: 8.8, angularSizeDeg: 0.025 },
  { id: 'm27', name: 'Dumbbell Nebula', type: 'planetary nebula', raHours: 19.993, decDeg: 22.721, magnitude: 7.4, angularSizeDeg: 0.13 },
  { id: 'm13', name: 'Hercules Cluster', type: 'globular cluster', raHours: 16.695, decDeg: 36.467, magnitude: 5.8, angularSizeDeg: 0.33 },
  { id: 'ngc3372', name: 'Carina Nebula', type: 'nebula', raHours: 10.752, decDeg: -59.867, magnitude: 1.0, angularSizeDeg: 2.0 },
  { id: 'ngc7000', name: 'North America Nebula', type: 'nebula', raHours: 20.974, decDeg: 44.333, magnitude: 4.0, angularSizeDeg: 2.0 },
  { id: 'omega-centauri', name: 'Omega Centauri', type: 'globular cluster', raHours: 13.447, decDeg: -47.48, magnitude: 3.9, angularSizeDeg: 0.6 },
]

function phaseLabel(phaseDeg: number): string {
  if (phaseDeg < 22.5 || phaseDeg >= 337.5) return 'New Moon'
  if (phaseDeg < 67.5) return 'Waxing crescent'
  if (phaseDeg < 112.5) return 'First quarter'
  if (phaseDeg < 157.5) return 'Waxing gibbous'
  if (phaseDeg < 202.5) return 'Full Moon'
  if (phaseDeg < 247.5) return 'Waning gibbous'
  if (phaseDeg < 292.5) return 'Third quarter'
  return 'Waning crescent'
}

function horizontalForEquatorial(date: Date, lat: number, lon: number, raHours: number, decDeg: number) {
  const observer = new Astronomy.Observer(lat, lon, 0)
  const horizontal = Astronomy.Horizon(date, observer, raHours, decDeg, 'normal')
  return {
    altitudeDeg: horizontal.altitude,
    azimuthDeg: horizontal.azimuth,
    compassLabel: azimuthToCompass(horizontal.azimuth),
    visible: horizontal.altitude > 0,
  }
}

function constellationName(raHours: number, decDeg: number): string | undefined {
  try {
    return Astronomy.Constellation(raHours, decDeg).name
  } catch {
    return undefined
  }
}

function bodyObject(id: string, name: string, kind: SkyMapObjectKind, body: Astronomy.Body, date: Date, lat: number, lon: number): SkyMapObject {
  const horizontal = getHorizontalPosition(body, date, lat, lon)
  const illumination = body === Astronomy.Body.Sun ? null : Astronomy.Illumination(body, date)
  return {
    id,
    kind,
    name,
    altitudeDeg: horizontal.altitudeDeg,
    azimuthDeg: horizontal.azimuthDeg,
    compassLabel: horizontal.compassLabel,
    visible: horizontal.altitudeDeg > 0,
    magnitude: illumination?.mag,
    phaseFraction: illumination?.phase_fraction,
    sourceLabel: kind === 'sun' || kind === 'moon' || kind === 'planet' ? 'NASA Solar System Exploration' : undefined,
    sourceUrl: SOLAR_SYSTEM_SOURCE_URLS[id.toLowerCase()],
  }
}

export function getSolarSystemObjects(date: Date, lat: number, lon: number): SkyMapObject[] {
  const moon = bodyObject('moon', 'Moon', 'moon', Astronomy.Body.Moon, date, lat, lon)
  const moonPhaseDeg = Astronomy.MoonPhase(date)
  moon.phaseLabel = phaseLabel(moonPhaseDeg)

  return [
    bodyObject('sun', 'Sun', 'sun', Astronomy.Body.Sun, date, lat, lon),
    moon,
    ...PLANET_BODIES.map(({ id, name, body }) => bodyObject(id, name, 'planet', body, date, lat, lon)),
  ]
}

function getSolarSystemObject(id: string, date: Date, lat: number, lon: number): SkyMapObject | null {
  const entry = SOLAR_SYSTEM_BODIES.get(id.toLowerCase())
  if (!entry) return null
  const object = bodyObject(id.toLowerCase(), entry.name, entry.kind, entry.body, date, lat, lon)
  if (id.toLowerCase() === 'moon') {
    object.phaseLabel = phaseLabel(Astronomy.MoonPhase(date))
  }
  return object
}

export function getDeepSkyObjects(date: Date, lat: number, lon: number): SkyMapObject[] {
  return DEEP_SKY_TARGETS.map((target) => ({
    id: target.id,
    kind: 'deep_sky',
    name: target.name,
    magnitude: target.magnitude,
    angularSizeDeg: target.angularSizeDeg,
    objectType: target.type,
    constellation: constellationName(target.raHours, target.decDeg),
    sourceLabel: 'SIMBAD object record',
    sourceUrl: simbadUrl(target.name),
    ...horizontalForEquatorial(date, lat, lon, target.raHours, target.decDeg),
  }))
}

function getDeepSkyObject(id: string, date: Date, lat: number, lon: number): SkyMapObject | null {
  const key = id.toLowerCase()
  const target = DEEP_SKY_TARGETS.find((item) => item.id === key)
  if (!target) return null
  return {
    id: target.id,
    kind: 'deep_sky',
    name: target.name,
    magnitude: target.magnitude,
    angularSizeDeg: target.angularSizeDeg,
    objectType: target.type,
    constellation: constellationName(target.raHours, target.decDeg),
    sourceLabel: 'SIMBAD object record',
    sourceUrl: simbadUrl(target.name),
    ...horizontalForEquatorial(date, lat, lon, target.raHours, target.decDeg),
  }
}

export function getStarObjects(date: Date, lat: number, lon: number): SkyMapObject[] {
  return BRIGHT_STARS.map((star) => ({
    id: star.id,
    kind: 'star',
    name: star.name,
    magnitude: star.magnitude,
    objectType: 'star',
    constellation: constellationName(star.raHours, star.decDeg),
    sourceLabel: 'SIMBAD object record',
    sourceUrl: simbadUrl(star.name),
    ...horizontalForEquatorial(date, lat, lon, star.raHours, star.decDeg),
  }))
}

export function getSkyMapObjects(date: Date, lat: number, lon: number): SkyMapObject[] {
  return [...getStarObjects(date, lat, lon), ...getSolarSystemObjects(date, lat, lon), ...getDeepSkyObjects(date, lat, lon)]
}

function eventTargetIds(event: Pick<SkyEvent, 'kind' | 'target'>): string[] {
  if (event.kind === 'moon_phase') return ['moon']
  if (event.kind === 'planet_event') return [event.target]
  if (event.kind === 'deep_sky') return [event.target]
  if (event.kind === 'conjunction') return event.target.split('_')
  if (event.kind === 'eclipse') return ['sun', 'moon']
  return []
}

export function getSkyMapObjectsForEvent(event: Pick<SkyEvent, 'kind' | 'target'>, date: Date, lat: number, lon: number): SkyMapObject[] {
  return eventTargetIds(event)
    .map((id) => getSolarSystemObject(id, date, lat, lon) ?? getDeepSkyObject(id, date, lat, lon))
    .filter((object): object is SkyMapObject => object != null)
}

export function getPrimarySkyMapObjectForEvent(event: Pick<SkyEvent, 'kind' | 'target'>, date: Date, lat: number, lon: number): SkyMapObject | null {
  const objects = getSkyMapObjectsForEvent(event, date, lat, lon)
  return objects.find((object) => object.visible) ?? objects[0] ?? null
}

export interface VisiblePlanetsTonight {
  visible: SkyMapObject[]
  notVisible: SkyMapObject[]
}

// Real per-location planet visibility for "what's up tonight" copy, instead
// of a static monthly blurb -- reuses the same alt/az computation the sky
// map itself draws from, so the two can never disagree.
export function getVisiblePlanetsTonight(date: Date, lat: number, lon: number): VisiblePlanetsTonight {
  const planets = PLANET_BODIES.map(({ id, name, body }) => bodyObject(id, name, 'planet', body, date, lat, lon)).sort(
    (a, b) => b.altitudeDeg - a.altitudeDeg,
  )
  return {
    visible: planets.filter((planet) => planet.visible),
    notVisible: planets.filter((planet) => !planet.visible),
  }
}
