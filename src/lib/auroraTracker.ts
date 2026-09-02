import type { CurrentLocation } from './currentLocation'
import type { SkyEvent } from './db'
import { isVisibleLocalEvent } from './eventFilters'

export type AuroraCall = 'go' | 'maybe' | 'quiet' | 'unknown'

export interface AuroraSnapshot {
  call: AuroraCall
  nextEvent: SkyEvent | null
  reason: string
}

export const AURORA_ALERTS_KEY = 'atlas-aurora-alerts'

export function auroraAlertsEnabled(): boolean {
  return localStorage.getItem(AURORA_ALERTS_KEY) === '1'
}

export function setAuroraAlertsEnabled(value: boolean): void {
  if (value) localStorage.setItem(AURORA_ALERTS_KEY, '1')
  else localStorage.removeItem(AURORA_ALERTS_KEY)
  window.dispatchEvent(new Event('atlas:aurora-alerts-changed'))
}

export function auroraSnapshot(
  events: SkyEvent[] | null,
  location: Pick<CurrentLocation, 'lat' | 'lon'>,
  now = new Date(),
): AuroraSnapshot {
  if (events == null) return { call: 'unknown', nextEvent: null, reason: 'Checking NOAA’s latest space-weather forecast…' }

  const horizon = now.getTime() + 3 * 86_400_000
  const candidates = events
    .filter((event) => event.kind === 'aurora')
    .filter((event) => new Date(event.endsAt || event.startsAt).getTime() >= now.getTime())
    .filter((event) => new Date(event.startsAt).getTime() <= horizon)
    .filter((event) => isVisibleLocalEvent(event, location.lat, location.lon))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))

  const nextEvent = candidates[0] ?? null
  if (!nextEvent) return { call: 'quiet', nextEvent: null, reason: 'No aurora forecast is currently visible from this location.' }

  const startsAt = new Date(nextEvent.startsAt).getTime()
  const call: AuroraCall = startsAt <= now.getTime() + 12 * 60 * 60_000 ? 'go' : 'maybe'
  const reason = call === 'go'
    ? 'Aurora activity is forecast during your next dark-sky window.'
    : 'Aurora activity is forecast here within the next three days.'
  return { call, nextEvent, reason }
}

export function auroraCallLabel(call: AuroraCall): string {
  return call === 'go' ? 'GO' : call === 'maybe' ? 'MAYBE' : call === 'quiet' ? 'QUIET' : 'UNKNOWN'
}
