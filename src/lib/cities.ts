// Keep in sync with scripts/sources/cities.mjs, which uses this same list
// to seed location-specific events (currently ISS passes). Also used as the
// manual-location picker (Settings, Dashboard's "Browse the world") — it is
// NOT used to snap real geolocation coordinates anymore (see
// src/lib/currentLocation.ts), only as a curated set of fallback/browse
// options, so it doesn't need to cover every place on Earth, just enough
// that most people can find something reasonably close.
//
// haversineKm now lives in eventGeo.mjs (see the note where it is
// re-exported below). Imported here because findNearestCity uses it.
import { haversineKm } from './eventGeo.mjs'

export interface City {
  name: string
  lat: number
  lon: number
  admin1?: string
  country?: string
  timeZone?: string
  population?: number
}

// Country and zone for the curated list. Search used to show these as bare
// coordinates ("Zurich 47.38, 8.54"), which is how a Swiss pick was stored
// with another Zurich's region attached. Zones also keep event times in the
// city's clock instead of the device's.
const CITY_FACTS: Record<string, Pick<City, 'admin1' | 'country' | 'timeZone'>> = {
  London: { country: 'United Kingdom', timeZone: 'Europe/London' },
  Amsterdam: { country: 'Netherlands', timeZone: 'Europe/Amsterdam' },
  Paris: { country: 'France', timeZone: 'Europe/Paris' },
  Berlin: { country: 'Germany', timeZone: 'Europe/Berlin' },
  Madrid: { country: 'Spain', timeZone: 'Europe/Madrid' },
  Rome: { country: 'Italy', timeZone: 'Europe/Rome' },
  Vienna: { country: 'Austria', timeZone: 'Europe/Vienna' },
  Dublin: { country: 'Ireland', timeZone: 'Europe/Dublin' },
  Lisbon: { country: 'Portugal', timeZone: 'Europe/Lisbon' },
  Brussels: { country: 'Belgium', timeZone: 'Europe/Brussels' },
  Zurich: { country: 'Switzerland', timeZone: 'Europe/Zurich' },
  Stockholm: { country: 'Sweden', timeZone: 'Europe/Stockholm' },
  Oslo: { country: 'Norway', timeZone: 'Europe/Oslo' },
  Copenhagen: { country: 'Denmark', timeZone: 'Europe/Copenhagen' },
  Helsinki: { country: 'Finland', timeZone: 'Europe/Helsinki' },
  Tallinn: { country: 'Estonia', timeZone: 'Europe/Tallinn' },
  Riga: { country: 'Latvia', timeZone: 'Europe/Riga' },
  Vilnius: { country: 'Lithuania', timeZone: 'Europe/Vilnius' },
  Warsaw: { country: 'Poland', timeZone: 'Europe/Warsaw' },
  Prague: { country: 'Czechia', timeZone: 'Europe/Prague' },
  Budapest: { country: 'Hungary', timeZone: 'Europe/Budapest' },
  Athens: { country: 'Greece', timeZone: 'Europe/Athens' },
  Reykjavik: { country: 'Iceland', timeZone: 'Atlantic/Reykjavik' },
  Moscow: { country: 'Russia', timeZone: 'Europe/Moscow' },
  Istanbul: { country: 'Türkiye', timeZone: 'Europe/Istanbul' },
  'New York': { admin1: 'New York', country: 'United States', timeZone: 'America/New_York' },
  'Los Angeles': { admin1: 'California', country: 'United States', timeZone: 'America/Los_Angeles' },
  Chicago: { admin1: 'Illinois', country: 'United States', timeZone: 'America/Chicago' },
  Toronto: { admin1: 'Ontario', country: 'Canada', timeZone: 'America/Toronto' },
  Vancouver: { admin1: 'British Columbia', country: 'Canada', timeZone: 'America/Vancouver' },
  'Mexico City': { country: 'Mexico', timeZone: 'America/Mexico_City' },
  'Rio de Janeiro': { country: 'Brazil', timeZone: 'America/Sao_Paulo' },
  'Buenos Aires': { country: 'Argentina', timeZone: 'America/Argentina/Buenos_Aires' },
  Santiago: { country: 'Chile', timeZone: 'America/Santiago' },
  Bogotá: { country: 'Colombia', timeZone: 'America/Bogota' },
  Lima: { country: 'Peru', timeZone: 'America/Lima' },
  Miami: { admin1: 'Florida', country: 'United States', timeZone: 'America/New_York' },
  'San Francisco': { admin1: 'California', country: 'United States', timeZone: 'America/Los_Angeles' },
  Seattle: { admin1: 'Washington', country: 'United States', timeZone: 'America/Los_Angeles' },
  Boston: { admin1: 'Massachusetts', country: 'United States', timeZone: 'America/New_York' },
  Denver: { admin1: 'Colorado', country: 'United States', timeZone: 'America/Denver' },
  Houston: { admin1: 'Texas', country: 'United States', timeZone: 'America/Chicago' },
  Cairo: { country: 'Egypt', timeZone: 'Africa/Cairo' },
  Nairobi: { country: 'Kenya', timeZone: 'Africa/Nairobi' },
  'Cape Town': { country: 'South Africa', timeZone: 'Africa/Johannesburg' },
  Lagos: { country: 'Nigeria', timeZone: 'Africa/Lagos' },
  Johannesburg: { country: 'South Africa', timeZone: 'Africa/Johannesburg' },
  Casablanca: { country: 'Morocco', timeZone: 'Africa/Casablanca' },
  'Addis Ababa': { country: 'Ethiopia', timeZone: 'Africa/Addis_Ababa' },
  Dubai: { country: 'United Arab Emirates', timeZone: 'Asia/Dubai' },
  'Tel Aviv': { country: 'Israel', timeZone: 'Asia/Jerusalem' },
  Riyadh: { country: 'Saudi Arabia', timeZone: 'Asia/Riyadh' },
  Tehran: { country: 'Iran', timeZone: 'Asia/Tehran' },
  Mumbai: { country: 'India', timeZone: 'Asia/Kolkata' },
  Delhi: { country: 'India', timeZone: 'Asia/Kolkata' },
  Beijing: { country: 'China', timeZone: 'Asia/Shanghai' },
  Shanghai: { country: 'China', timeZone: 'Asia/Shanghai' },
  Tokyo: { country: 'Japan', timeZone: 'Asia/Tokyo' },
  Seoul: { country: 'South Korea', timeZone: 'Asia/Seoul' },
  Singapore: { country: 'Singapore', timeZone: 'Asia/Singapore' },
  Bangkok: { country: 'Thailand', timeZone: 'Asia/Bangkok' },
  Jakarta: { country: 'Indonesia', timeZone: 'Asia/Jakarta' },
  Manila: { country: 'Philippines', timeZone: 'Asia/Manila' },
  'Hong Kong': { country: 'Hong Kong', timeZone: 'Asia/Hong_Kong' },
  Karachi: { country: 'Pakistan', timeZone: 'Asia/Karachi' },
  Dhaka: { country: 'Bangladesh', timeZone: 'Asia/Dhaka' },
  'Kuala Lumpur': { country: 'Malaysia', timeZone: 'Asia/Kuala_Lumpur' },
  Melbourne: { admin1: 'Victoria', country: 'Australia', timeZone: 'Australia/Melbourne' },
  Sydney: { admin1: 'New South Wales', country: 'Australia', timeZone: 'Australia/Sydney' },
  Auckland: { country: 'New Zealand', timeZone: 'Pacific/Auckland' },
  Brisbane: { admin1: 'Queensland', country: 'Australia', timeZone: 'Australia/Brisbane' },
  Perth: { admin1: 'Western Australia', country: 'Australia', timeZone: 'Australia/Perth' },
  Wellington: { country: 'New Zealand', timeZone: 'Pacific/Auckland' },
}

function withFacts(city: City): City {
  const facts = CITY_FACTS[city.name]
  if (!facts) return city
  return {
    ...facts,
    ...city,
    admin1: city.admin1 ?? facts.admin1,
    country: city.country ?? facts.country,
    timeZone: city.timeZone ?? facts.timeZone,
  }
}

export function cityLabel(city: City): string {
  return [city.name, city.admin1, city.country].filter((part, index, values) => part && values.indexOf(part) === index).join(', ')
}

export const CITIES: City[] = ([
  // Europe
  { name: 'London', lat: 51.5074, lon: -0.1278 },
  { name: 'Amsterdam', lat: 52.3676, lon: 4.9041 },
  { name: 'Paris', lat: 48.8566, lon: 2.3522 },
  { name: 'Berlin', lat: 52.52, lon: 13.405 },
  { name: 'Madrid', lat: 40.4168, lon: -3.7038 },
  { name: 'Rome', lat: 41.9028, lon: 12.4964 },
  { name: 'Vienna', lat: 48.2082, lon: 16.3738 },
  { name: 'Dublin', lat: 53.3498, lon: -6.2603 },
  { name: 'Lisbon', lat: 38.7223, lon: -9.1393 },
  { name: 'Brussels', lat: 50.8503, lon: 4.3517 },
  { name: 'Zurich', lat: 47.3769, lon: 8.5417, timeZone: 'Europe/Zurich' },
  { name: 'Stockholm', lat: 59.3293, lon: 18.0686 },
  { name: 'Oslo', lat: 59.9139, lon: 10.7522 },
  { name: 'Copenhagen', lat: 55.6761, lon: 12.5683 },
  { name: 'Helsinki', lat: 60.1699, lon: 24.9384 },
  { name: 'Tallinn', lat: 59.437, lon: 24.7536 },
  { name: 'Riga', lat: 56.9496, lon: 24.1052 },
  { name: 'Vilnius', lat: 54.6872, lon: 25.2797 },
  { name: 'Warsaw', lat: 52.2297, lon: 21.0122 },
  { name: 'Prague', lat: 50.0755, lon: 14.4378 },
  { name: 'Budapest', lat: 47.4979, lon: 19.0402 },
  { name: 'Athens', lat: 37.9838, lon: 23.7275 },
  { name: 'Reykjavik', lat: 64.1466, lon: -21.9426, timeZone: 'Atlantic/Reykjavik' },
  { name: 'Moscow', lat: 55.7558, lon: 37.6173 },
  { name: 'Istanbul', lat: 41.0082, lon: 28.9784 },
  // Americas
  { name: 'New York', lat: 40.7128, lon: -74.006 },
  { name: 'Los Angeles', lat: 34.0522, lon: -118.2437 },
  { name: 'Chicago', lat: 41.8781, lon: -87.6298 },
  { name: 'Toronto', lat: 43.6532, lon: -79.3832 },
  { name: 'Vancouver', lat: 49.2827, lon: -123.1207 },
  { name: 'Mexico City', lat: 19.4326, lon: -99.1332 },
  { name: 'Rio de Janeiro', lat: -22.9068, lon: -43.1729 },
  { name: 'Buenos Aires', lat: -34.6037, lon: -58.3816 },
  { name: 'Santiago', lat: -33.4489, lon: -70.6693, timeZone: 'America/Santiago' },
  { name: 'Bogotá', lat: 4.711, lon: -74.0721 },
  { name: 'Lima', lat: -12.0464, lon: -77.0428 },
  { name: 'Miami', lat: 25.7617, lon: -80.1918 },
  { name: 'San Francisco', lat: 37.7749, lon: -122.4194 },
  { name: 'Seattle', lat: 47.6062, lon: -122.3321 },
  { name: 'Boston', lat: 42.3601, lon: -71.0589 },
  { name: 'Denver', lat: 39.7392, lon: -104.9903 },
  { name: 'Houston', lat: 29.7604, lon: -95.3698 },
  // Africa
  { name: 'Cairo', lat: 30.0444, lon: 31.2357 },
  { name: 'Nairobi', lat: -1.2921, lon: 36.8219 },
  { name: 'Cape Town', lat: -33.9249, lon: 18.4241 },
  { name: 'Lagos', lat: 6.5244, lon: 3.3792 },
  { name: 'Johannesburg', lat: -26.2041, lon: 28.0473 },
  { name: 'Casablanca', lat: 33.5731, lon: -7.5898 },
  { name: 'Addis Ababa', lat: 9.03, lon: 38.74 },
  // Middle East
  { name: 'Dubai', lat: 25.2048, lon: 55.2708 },
  { name: 'Tel Aviv', lat: 32.0853, lon: 34.7818 },
  { name: 'Riyadh', lat: 24.7136, lon: 46.6753 },
  { name: 'Tehran', lat: 35.6892, lon: 51.389 },
  // Asia
  { name: 'Mumbai', lat: 19.076, lon: 72.8777 },
  { name: 'Delhi', lat: 28.7041, lon: 77.1025 },
  { name: 'Beijing', lat: 39.9042, lon: 116.4074 },
  { name: 'Shanghai', lat: 31.2304, lon: 121.4737 },
  { name: 'Tokyo', lat: 35.6762, lon: 139.6503 },
  { name: 'Seoul', lat: 37.5665, lon: 126.978 },
  { name: 'Singapore', lat: 1.3521, lon: 103.8198 },
  { name: 'Bangkok', lat: 13.7563, lon: 100.5018 },
  { name: 'Jakarta', lat: -6.2088, lon: 106.8456 },
  { name: 'Manila', lat: 14.5995, lon: 120.9842 },
  { name: 'Hong Kong', lat: 22.3193, lon: 114.1694 },
  { name: 'Karachi', lat: 24.8607, lon: 67.0011 },
  { name: 'Dhaka', lat: 23.8103, lon: 90.4125 },
  { name: 'Kuala Lumpur', lat: 3.139, lon: 101.6869 },
  // Oceania
  { name: 'Melbourne', lat: -37.8136, lon: 144.9631, timeZone: 'Australia/Melbourne' },
  { name: 'Sydney', lat: -33.8688, lon: 151.2093 },
  { name: 'Auckland', lat: -36.8485, lon: 174.7633 },
  { name: 'Brisbane', lat: -27.4698, lon: 153.0251 },
  { name: 'Perth', lat: -31.9505, lon: 115.8605 },
  { name: 'Wellington', lat: -41.2865, lon: 174.7762 },
] as City[]).map(withFacts)

// Moved to eventGeo.mjs so the past-check-in matcher can import it under
// plain `node --test`, which cannot resolve this file's extensionless
// imports. Re-exported so every existing caller is unchanged.
export { haversineKm }

export function findNearestCity(lat: number, lon: number): City {
  return CITIES.reduce((closest, city) => (haversineKm(city, { lat, lon }) < haversineKm(closest, { lat, lon }) ? city : closest))
}
