// Holiday/travel windows a user has told Atlas about so the feed can be
// tailored to where they'll actually be, not just their home location.
// Stored locally like getReadyReminders.ts's list -- no backend sync yet.
import { cityLabel, type City } from './cities'

export interface Trip {
  id: string
  name: string
  lat: number
  lon: number
  timeZone?: string
  // Inclusive local calendar dates, 'YYYY-MM-DD'.
  startDate: string
  endDate: string
}

const STORAGE_KEY = 'atlas-trips'

function readRaw(): Trip[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Trip[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeRaw(trips: Trip[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trips))
  window.dispatchEvent(new Event('atlas:trips-changed'))
}

export function listTrips(): Trip[] {
  return readRaw().sort((a, b) => a.startDate.localeCompare(b.startDate))
}

export function addTrip(input: { city: City; startDate: string; endDate: string }): Trip {
  const trip: Trip = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: cityLabel(input.city),
    lat: input.city.lat,
    lon: input.city.lon,
    timeZone: input.city.timeZone,
    startDate: input.startDate,
    endDate: input.endDate,
  }
  writeRaw([...readRaw(), trip])
  return trip
}

export function removeTrip(id: string) {
  writeRaw(readRaw().filter((trip) => trip.id !== id))
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// The trip covering `date` (defaults to now), if any. When more than one
// trip somehow overlaps the same date, the soonest-starting one wins --
// arbitrary but deterministic, and overlapping trips shouldn't happen via
// the UI in the first place.
export function activeTripFor(date: Date = new Date()): Trip | null {
  const key = localDateKey(date)
  return listTrips().find((trip) => trip.startDate <= key && key <= trip.endDate) ?? null
}
