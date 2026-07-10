// Keep in sync with scripts/sources/cities.mjs, which uses this same list
// to seed location-specific events (currently ISS passes).
export interface City {
  name: string
  lat: number
  lon: number
}

export const CITIES: City[] = [
  { name: 'London', lat: 51.5074, lon: -0.1278 },
  { name: 'New York', lat: 40.7128, lon: -74.006 },
  { name: 'Los Angeles', lat: 34.0522, lon: -118.2437 },
  { name: 'Mexico City', lat: 19.4326, lon: -99.1332 },
  { name: 'Rio de Janeiro', lat: -22.9068, lon: -43.1729 },
  { name: 'Reykjavik', lat: 64.1466, lon: -21.9426 },
  { name: 'Cairo', lat: 30.0444, lon: 31.2357 },
  { name: 'Nairobi', lat: -1.2921, lon: 36.8219 },
  { name: 'Cape Town', lat: -33.9249, lon: 18.4241 },
  { name: 'Moscow', lat: 55.7558, lon: 37.6173 },
  { name: 'Mumbai', lat: 19.076, lon: 72.8777 },
  { name: 'Beijing', lat: 39.9042, lon: 116.4074 },
  { name: 'Tokyo', lat: 35.6762, lon: 139.6503 },
  { name: 'Singapore', lat: 1.3521, lon: 103.8198 },
  { name: 'Melbourne', lat: -37.8136, lon: 144.9631 },
  { name: 'Sydney', lat: -33.8688, lon: 151.2093 },
  { name: 'Auckland', lat: -36.8485, lon: 174.7633 },
]

export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function findNearestCity(lat: number, lon: number): City {
  return CITIES.reduce((closest, city) => (haversineKm(city, { lat, lon }) < haversineKm(closest, { lat, lon }) ? city : closest))
}
