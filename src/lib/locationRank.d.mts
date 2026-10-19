export const SAME_PLACE_KM: number

export interface RankedPlace {
  name: string
  lat: number
  lon: number
  admin1?: string
  country?: string
  timeZone?: string
  population?: number
}

export function reconcilePlace<T extends RankedPlace>(city: T, curatedCities: readonly RankedPlace[]): T

export function mergeLocationResults(query: string, curatedCities: readonly RankedPlace[], remote: readonly RankedPlace[]): RankedPlace[]
