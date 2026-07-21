import type { DarkSkySite } from './darkSky'

export type MapProvider = 'apple' | 'google'
export type RouteMode = 'driving' | 'transit' | 'walking'

const PROVIDER_KEY = 'atlas-map-provider'
const MODE_KEY = 'atlas-map-mode'

function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent)
}

export function defaultMapProvider(): MapProvider {
  return isApplePlatform() ? 'apple' : 'google'
}

export function getPreferredMapProvider(): MapProvider {
  if (typeof localStorage === 'undefined') return defaultMapProvider()
  const value = localStorage.getItem(PROVIDER_KEY)
  return value === 'apple' || value === 'google' ? value : defaultMapProvider()
}

export function setPreferredMapProvider(provider: MapProvider): void {
  localStorage.setItem(PROVIDER_KEY, provider)
}

export function getPreferredRouteMode(): RouteMode {
  if (typeof localStorage === 'undefined') return 'transit'
  const value = localStorage.getItem(MODE_KEY)
  return value === 'driving' || value === 'transit' || value === 'walking' ? value : 'transit'
}

export function setPreferredRouteMode(mode: RouteMode): void {
  localStorage.setItem(MODE_KEY, mode)
}

export function routeUrl({
  site,
  origin,
  mode,
  provider,
}: {
  site: DarkSkySite
  origin?: { lat: number; lon: number }
  mode: RouteMode
  provider: MapProvider
}): string {
  if (provider === 'apple') {
    const params = new URLSearchParams({
      destination: `${site.lat},${site.lon}`,
      mode,
    })
    if (origin) params.set('source', `${origin.lat},${origin.lon}`)
    return `https://maps.apple.com/directions?${params.toString()}`
  }

  const params = new URLSearchParams({
    api: '1',
    destination: `${site.lat},${site.lon}`,
    travelmode: mode,
  })
  if (origin) params.set('origin', `${origin.lat},${origin.lon}`)
  if (mode === 'driving') params.set('dir_action', 'navigate')
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

export function copyCoordinates(site: DarkSkySite): Promise<void> {
  return navigator.clipboard.writeText(`${site.lat},${site.lon}`)
}
