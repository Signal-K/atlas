import type { ObservationLogEntry } from './db'
import { pb } from './pocketbase'
import { parsePbDate } from './pocketbaseDate'

export interface CityStamp {
  cityName: string
  count: number
  firstCheckedInAt: string
  lastCheckedInAt: string
  remoteId?: string
  isPublic?: boolean
  shareSlug?: string
}

export interface PublicCityStamp {
  cityName: string
  checkinCount: number
  firstCheckedInAt: string
  lastCheckedInAt: string
}

function cityKey(cityName: string): string {
  return cityName
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function shareSlug(userId: string, cityName: string): string {
  return `${cityKey(cityName)}-${userId.slice(0, 8)}`
}

export function cityStampShareUrl(slug: string): string {
  return `${window.location.origin}/stamps/${slug}`
}

export function cityStampsFromObservations(entries: ObservationLogEntry[]): CityStamp[] {
  const stamps = new Map<string, CityStamp>()

  for (const entry of entries) {
    const cityName = entry.locationLabel?.trim()
    if (!cityName) continue

    const existing = stamps.get(cityName)
    if (!existing) {
      stamps.set(cityName, {
        cityName,
        count: 1,
        firstCheckedInAt: entry.observedAt,
        lastCheckedInAt: entry.observedAt,
      })
      continue
    }

    existing.count += 1
    if (entry.observedAt < existing.firstCheckedInAt) existing.firstCheckedInAt = entry.observedAt
    if (entry.observedAt > existing.lastCheckedInAt) existing.lastCheckedInAt = entry.observedAt
  }

  return Array.from(stamps.values()).sort((a, b) => b.lastCheckedInAt.localeCompare(a.lastCheckedInAt))
}

export async function pushCityStampFromObservation(entry: ObservationLogEntry): Promise<void> {
  const cityName = entry.locationLabel?.trim()
  const userId = pb.authStore.record?.id
  if (!cityName || !userId || !pb.authStore.isValid || !navigator.onLine) return

  const key = cityKey(cityName)
  try {
    const existing = await pb.collection('atlas_city_stamps').getFirstListItem(`user = "${userId}" && city_key = "${key}"`)
    await pb.collection('atlas_city_stamps').update(existing.id, {
      checkin_count: Number(existing.checkin_count ?? 0) + 1,
      first_checked_in_at:
        typeof existing.first_checked_in_at === 'string' && existing.first_checked_in_at < entry.observedAt
          ? existing.first_checked_in_at
          : entry.observedAt,
      last_checked_in_at:
        typeof existing.last_checked_in_at === 'string' && existing.last_checked_in_at > entry.observedAt
          ? existing.last_checked_in_at
          : entry.observedAt,
    })
  } catch {
    await pb.collection('atlas_city_stamps').create({
      user: userId,
      city_key: key,
      city_name: cityName,
      checkin_count: 1,
      first_checked_in_at: entry.observedAt,
      last_checked_in_at: entry.observedAt,
      public: false,
      share_slug: shareSlug(userId, cityName),
    })
  }
}

export async function shareCityStamp(stamp: CityStamp): Promise<string> {
  const userId = pb.authStore.record?.id
  if (!userId || !pb.authStore.isValid) throw new Error('Sign in to share a city stamp')

  const key = cityKey(stamp.cityName)
  let record
  try {
    record = await pb.collection('atlas_city_stamps').getFirstListItem(`user = "${userId}" && city_key = "${key}"`)
  } catch {
    record = await pb.collection('atlas_city_stamps').create({
      user: userId,
      city_key: key,
      city_name: stamp.cityName,
      checkin_count: stamp.count,
      first_checked_in_at: stamp.firstCheckedInAt,
      last_checked_in_at: stamp.lastCheckedInAt,
      public: false,
      share_slug: shareSlug(userId, stamp.cityName),
    })
  }

  const slug = (record.share_slug as string | undefined) || shareSlug(userId, stamp.cityName)
  await pb.collection('atlas_city_stamps').update(record.id, {
    public: true,
    share_slug: slug,
    checkin_count: Math.max(Number(record.checkin_count ?? 0), stamp.count),
    first_checked_in_at: stamp.firstCheckedInAt,
    last_checked_in_at: stamp.lastCheckedInAt,
  })
  return cityStampShareUrl(slug)
}

export async function getPublicCityStamp(slug: string): Promise<PublicCityStamp | null> {
  try {
    const record = await pb.collection('atlas_city_stamps').getFirstListItem(`share_slug = "${slug}" && public = true`)
    return {
      cityName: record.city_name as string,
      checkinCount: Number(record.checkin_count ?? 0),
      // parsePbDate -- CityStampSharePage.tsx calls new Date(...) on these
      // directly, which is Invalid Date in real Safari on PocketBase's raw
      // space-separated format. See pocketbaseDate.ts.
      firstCheckedInAt: parsePbDate(record.first_checked_in_at as string).toISOString(),
      lastCheckedInAt: parsePbDate(record.last_checked_in_at as string).toISOString(),
    }
  } catch {
    return null
  }
}
