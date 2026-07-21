import { CITIES, cityLabel, type City } from './cities'

interface GeocodingResult {
  id?: number
  name?: string
  latitude?: number
  longitude?: number
  admin1?: string
  country?: string
  timezone?: string
}

export function curatedLocationMatches(query: string, limit = 6): City[] {
  const normalized = query.trim().toLocaleLowerCase()
  if (!normalized) return []
  return CITIES.filter((city) => cityLabel(city).toLocaleLowerCase().includes(normalized)).slice(0, limit)
}

export async function searchLocations(query: string, signal?: AbortSignal): Promise<City[]> {
  const normalized = query.trim()
  if (normalized.length < 2) return curatedLocationMatches(normalized)

  const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
  url.searchParams.set('name', normalized)
  url.searchParams.set('count', '8')
  url.searchParams.set('language', 'en')
  url.searchParams.set('format', 'json')

  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Location search failed: ${response.status}`)
  const payload = (await response.json()) as { results?: GeocodingResult[] }

  return (payload.results ?? []).flatMap((result) => {
    if (!result.name || !Number.isFinite(result.latitude) || !Number.isFinite(result.longitude)) return []
    return [{
      name: result.name,
      lat: result.latitude as number,
      lon: result.longitude as number,
      admin1: result.admin1,
      country: result.country,
      timeZone: result.timezone,
    }]
  })
}
