import { getVisiblePlanetsTonight, getStarObjects } from './skyMapLayers'
import type { SkyEvent } from './db'

const MAX_STARS_MENTIONED = 3

// Matches SkyEventBrowser's own day-strip window -- filler guides beyond
// this are low value (planet positions this far out are still fine, but
// nothing browses that far day-by-day) and not worth the extra ephemeris
// calls.
export const SKY_GUIDE_WINDOW_DAYS = 14

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
