import { getVisiblePlanetsTonight } from './skyMapLayers'
import type { SkyEvent } from './db'

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

// Client-only, non-persisted SkyEvent so it can reuse EventDetailPanel and
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
