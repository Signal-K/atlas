import { getDeepSkyObjects, getStarObjects, getVisiblePlanetsTonight, type SkyMapObject } from './skyMapLayers'
import type { SkyEvent } from './db'

const MAX_STARS_MENTIONED = 3

// Matches SkyEventBrowser's own day-strip window -- filler guides beyond
// this are low value (planet positions this far out are still fine, but
// nothing browses that far day-by-day) and not worth the extra ephemeris
// calls.
export const SKY_GUIDE_WINDOW_DAYS = 14

// The event feed is also an observing tool.  A remote catalogue is useful
// for things that happen at a particular moment, but it cannot be the only
// source of content: stars, clusters and nebulae are worthwhile on ordinary
// clear nights too.  Keep this modest (rather than dumping the whole Messier
// catalogue into every day) and compute it locally so it works for Perth,
// Melbourne, or a traveller's selected location without a new ingest job.
const BRIGHT_STARS_PER_NIGHT = 2
const BINOCULAR_TARGETS_PER_NIGHT = 2
const TELESCOPE_TARGETS_PER_NIGHT = 2
const MIN_TARGET_ALTITUDE_DEG = 28

function observingTimeFor(day: Date): Date {
  const evening = new Date(day)
  evening.setHours(21, 0, 0, 0)
  return evening
}

function dateKeyFor(day: Date): string {
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
}

function targetDirection(target: SkyMapObject): string {
  return `${Math.round(target.altitudeDeg)}° up in the ${target.compassLabel}`
}

function deepSkyRank(a: SkyMapObject, b: SkyMapObject): number {
  // High altitude matters more than a small magnitude difference: a faint
  // cluster high above suburban haze is usually a better real-world target
  // than a nominally brighter one scraping the horizon.
  const aScore = a.altitudeDeg * 0.12 - (a.magnitude ?? 99)
  const bScore = b.altitudeDeg * 0.12 - (b.magnitude ?? 99)
  return bScore - aScore
}

/**
 * Location-aware, non-persisted observing targets for the next two weeks.
 * They deliberately look like SkyEvents so the existing filters, event
 * detail page, reminders and sky-position UI work without pretending that a
 * star has a one-off calendar date.
 */
export function buildDailyObservingTargets(startDate: Date, days: number, lat: number, lon: number): SkyEvent[] {
  const generatedAt = new Date().toISOString()

  return Array.from({ length: days }, (_, dayOffset) => {
    const day = new Date(startDate)
    day.setHours(0, 0, 0, 0)
    day.setDate(day.getDate() + dayOffset)
    const evening = observingTimeFor(day)
    const dateKey = dateKeyFor(day)

    const stars = getStarObjects(evening, lat, lon)
      .filter((star) => star.visible && star.altitudeDeg >= MIN_TARGET_ALTITUDE_DEG && (star.magnitude ?? 99) <= 1.5)
      .sort((a, b) => (a.magnitude ?? 99) - (b.magnitude ?? 99) || b.altitudeDeg - a.altitudeDeg)
      .slice(0, BRIGHT_STARS_PER_NIGHT)
      .map((star) => ({
        id: `bright-star-${dateKey}-${star.id}`,
        kind: 'bright_star',
        target: star.id,
        title: star.name,
        description: `${star.name}${star.constellation ? ` in ${star.constellation}` : ''} is a bright naked-eye target, ${targetDirection(star)} at 9pm.`,
        content: `${star.name}${star.constellation ? ` is in ${star.constellation} and` : ''} is one of tonight's brightest stars. Find it ${targetDirection(star)}; binoculars bring out its colour and nearby star field.`,
        startsAt: evening.toISOString(),
        endsAt: new Date(evening.getTime() + 3 * 3_600_000).toISOString(),
        updatedAt: generatedAt,
      }))

    const candidates = getDeepSkyObjects(evening, lat, lon)
      .filter((target) => target.visible && target.altitudeDeg >= MIN_TARGET_ALTITUDE_DEG)
      .sort(deepSkyRank)
    const binocularTargets = candidates
      .filter((target) => (target.magnitude ?? 99) <= 6.5)
      .slice(0, BINOCULAR_TARGETS_PER_NIGHT)
    const binocularIds = new Set(binocularTargets.map((target) => target.id))
    const telescopeTargets = candidates
      .filter((target) => !binocularIds.has(target.id) && (target.magnitude ?? 99) <= 9.5)
      .slice(0, TELESCOPE_TARGETS_PER_NIGHT)

    const binocularEvents = binocularTargets.map((target) => ({
      id: `binocular-target-${dateKey}-${target.id}`,
      kind: 'deep_sky',
      target: target.id,
      title: target.name,
      description: `${target.objectType ?? 'Deep-sky object'} · magnitude ${(target.magnitude ?? 0).toFixed(1)} · ${targetDirection(target)} at 9pm.`,
      content: `${target.name} is a ${target.objectType ?? 'deep-sky object'} suited to binoculars from a dark enough site. It is ${targetDirection(target)} at 9pm; let your eyes adjust before looking for its faint shape.`,
      startsAt: evening.toISOString(),
      endsAt: new Date(evening.getTime() + 3 * 3_600_000).toISOString(),
      updatedAt: generatedAt,
    }))

    const telescopeEvents = telescopeTargets.map((target) => ({
      id: `telescope-target-${dateKey}-${target.id}`,
      kind: 'telescope_target',
      target: target.id,
      title: target.name,
      description: `${target.objectType ?? 'Deep-sky object'} · magnitude ${(target.magnitude ?? 0).toFixed(1)} · ${targetDirection(target)} at 9pm.`,
      content: `${target.name} is a ${target.objectType ?? 'deep-sky object'} for a telescope on a clear night. It is ${targetDirection(target)} at 9pm; start at low magnification and use a dark, steady view.`,
      startsAt: evening.toISOString(),
      endsAt: new Date(evening.getTime() + 3 * 3_600_000).toISOString(),
      updatedAt: generatedAt,
    }))

    return [...stars, ...binocularEvents, ...telescopeEvents]
  }).flat()
}

function describeVisiblePlanets(now: Date, lat: number, lon: number): string {
  const { visible, notVisible } = getVisiblePlanetsTonight(now, lat, lon)
  if (visible.length === 0) {
    return 'No naked-eye planets are above your horizon right now — check back later tonight or tomorrow evening.'
  }
  const visibleText = visible
    .map((planet) => `${planet.name} (${Math.round(planet.altitudeDeg)}° up, ${planet.compassLabel})`)
    .join(' and ')
  const sentence = `${visibleText} ${visible.length === 1 ? 'is' : 'are'} visible tonight from your location.`
  if (notVisible.length === 0) return sentence
  const notVisibleNames = notVisible.map((planet) => planet.name).join(', ')
  return `${sentence} ${notVisibleNames} ${notVisible.length === 1 ? 'is' : 'are'} below the horizon right now.`
}

// Combines planets with the brightest above-horizon stars so a night with no
// planets up still has something concrete to point at -- the naked-eye sky
// is essentially never truly empty, only the discrete-event calendar is.
function describeVisibleSky(now: Date, lat: number, lon: number): string {
  const { visible: visiblePlanets, notVisible } = getVisiblePlanetsTonight(now, lat, lon)
  const visibleStars = getStarObjects(now, lat, lon)
    .filter((star) => star.visible)
    .sort((a, b) => (a.magnitude ?? 99) - (b.magnitude ?? 99))
    .slice(0, MAX_STARS_MENTIONED)

  const parts: string[] = []
  if (visiblePlanets.length > 0) {
    const planetsText = visiblePlanets
      .map((planet) => `${planet.name} (${Math.round(planet.altitudeDeg)}° up, ${planet.compassLabel})`)
      .join(' and ')
    parts.push(`${planetsText} ${visiblePlanets.length === 1 ? 'is' : 'are'} visible tonight from your location.`)
  }
  if (visibleStars.length > 0) {
    parts.push(`Brightest stars overhead: ${visibleStars.map((star) => `${star.name}${star.constellation ? ` (${star.constellation})` : ''}`).join(', ')}.`)
  }
  if (parts.length === 0) {
    return 'No naked-eye planets or bright stars are well-placed right now — check back later tonight or tomorrow evening.'
  }
  if (notVisible.length > 0 && visiblePlanets.length > 0) {
    parts.push(`${notVisible.map((planet) => planet.name).join(', ')} ${notVisible.length === 1 ? 'is' : 'are'} below the horizon right now.`)
  }
  return parts.join(' ')
}

// Client-only, non-persisted SkyEvent so it can reuse EntryDetailView and
// SkyEventBrowser exactly like a real synced event, but its content is
// computed fresh per location/date instead of coming from Dexie -- see the
// "visible planets this month" bug this replaces (STS bug report, 2026-07).
export function buildVisiblePlanetsEvent(now: Date, lat: number, lon: number): SkyEvent {
  const dateKey = now.toISOString().slice(0, 10)
  const evening = new Date(now)
  evening.setHours(21, 0, 0, 0)
  if (evening.getTime() < now.getTime()) evening.setTime(now.getTime())
  const description = describeVisiblePlanets(now, lat, lon)
  return {
    id: `visible-planets-${dateKey}`,
    kind: 'night_sky_guide',
    target: 'visible_planets',
    title: 'Visible planets tonight',
    description,
    content: description,
    startsAt: evening.toISOString(),
    endsAt: new Date(evening.getTime() + 3 * 3_600_000).toISOString(),
    latitude: lat,
    longitude: lon,
    updatedAt: now.toISOString(),
  }
}

// Ranked "what's actually up right now" for the home screen -- planets and
// bright stars above the horizon, brightest (lowest magnitude) first. Reuses
// the exact same alt/az computation as describeVisibleSky above so the home
// screen's list and the guide copy it's built from can never disagree.
export function topVisibleTonight(now: Date, lat: number, lon: number, count = 3): SkyMapObject[] {
  const { visible: visiblePlanets } = getVisiblePlanetsTonight(now, lat, lon)
  const visibleStars = getStarObjects(now, lat, lon).filter((star) => star.visible)
  return [...visiblePlanets, ...visibleStars]
    .sort((a, b) => (a.magnitude ?? 99) - (b.magnitude ?? 99))
    .slice(0, count)
}

// One "visible tonight" filler per day in the window, for days that don't
// already have a real scheduled event -- the browse feed and calendar strip
// otherwise leave those days visually blank, which reads as broken since the
// naked-eye sky (planets, bright stars) is essentially always there.
export function buildDailySkyGuideEvents(startDate: Date, days: number, lat: number, lon: number): SkyEvent[] {
  const generatedAt = new Date().toISOString()
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(startDate)
    day.setHours(0, 0, 0, 0)
    day.setDate(day.getDate() + i)
    const evening = new Date(day)
    evening.setHours(21, 0, 0, 0)
    const dateKey = day.toISOString().slice(0, 10)
    const description = describeVisibleSky(evening, lat, lon)
    return {
      id: `sky-guide-${dateKey}`,
      kind: 'night_sky_guide',
      target: 'visible_sky',
      title: i === 0 ? 'Visible tonight' : `Visible ${day.toLocaleDateString(undefined, { weekday: 'short' })}`,
      description,
      content: description,
      startsAt: evening.toISOString(),
      endsAt: new Date(evening.getTime() + 3 * 3_600_000).toISOString(),
      latitude: lat,
      longitude: lon,
      updatedAt: generatedAt,
    }
  })
}
