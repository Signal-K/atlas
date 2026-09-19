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

// The trip covering `date` (defaults to now), if any.
//
// Overlaps are real, not hypothetical: a handover day belongs to the trip
// ending that day *and* the trip starting it. Flying Perth -> Darwin on the
// 27th of a 24-27 and a 27-30 trip puts the 27th in both windows, and the old
// soonest-starting-wins rule picked Perth -- the city the user had just left,
// with the wrong forecast for the one they'd arrived in. The later-starting
// trip wins, so the newest leg is the one in force. Ties fall back to list
// order, which is harmless because a tie means both trips cover the date
// identically.
export function activeTripFor(date: Date = new Date()): Trip | null {
  const key = localDateKey(date)
  // listTrips() is start-ascending, so the last match is the latest-starting.
  const matches = listTrips().filter((trip) => trip.startDate <= key && key <= trip.endDate)
  return matches[matches.length - 1] ?? null
}
