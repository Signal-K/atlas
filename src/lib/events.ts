import { pb } from './pocketbase'
import { MOCK_EVENTS } from './mockEvents'

// Matches the record shape scripts/ingest.mjs writes into PocketBase's
// sky_events collection (see scripts/sources/*.mjs) -- kept intentionally
// looser than the full schema since the UI only reads these fields.
export interface AtlasEvent {
  id: string
  kind: string
  target: string
  title: string
  description?: string
  content?: string
  starts_at: string
  ends_at?: string
  latitude?: number
  longitude?: number
  image_url?: string
  image_credit?: string
}

// Real events come from the scheduled ingest (scripts/ingest.mjs, run via
// `npm run ingest` locally or on a schedule in CI); this only reads. Falls
// back to a bundled mock set when PocketBase is unreachable (offline/demo
// mode) or hasn't been seeded yet, so Events never renders empty in dev.
export async function fetchUpcomingEvents(windowDays: number): Promise<AtlasEvent[]> {
  const now = new Date()
  const end = new Date(now.getTime() + windowDays * 86_400_000)

  try {
    const records = await pb.collection('sky_events').getFullList<AtlasEvent>({
      filter: `starts_at >= "${now.toISOString().replace('T', ' ')}" && starts_at <= "${end.toISOString().replace('T', ' ')}"`,
      sort: 'starts_at',
    })
    if (records.length > 0) return records
  } catch {
    // PocketBase unreachable (offline, demo mode, or dev without Docker
    // running) -- fall through to the mock set below.
  }

  return MOCK_EVENTS.filter((event) => {
    const t = new Date(event.starts_at).getTime()
    return t >= now.getTime() && t <= end.getTime()
  })
}

// Single-event lookup for the detail subpage. Tries PocketBase first (the
// real record, in case its content/image fields were backfilled since the
// list fetch ran); falls back to the mock set by id so deep links still
// work offline/in demo mode.
export async function fetchEvent(id: string): Promise<AtlasEvent | null> {
  try {
    const record = await pb.collection('sky_events').getOne<AtlasEvent>(id)
    return record
  } catch {
    // Not found, offline, or a mock id -- fall through.
  }
  return MOCK_EVENTS.find((event) => event.id === id) ?? null
}

// Events that have already started, most recent first -- backs the "past
// events" archive view. windowDays bounds how far back to look so the
// query/mock-filter stays cheap.
export async function fetchPastEvents(windowDays: number): Promise<AtlasEvent[]> {
  const now = new Date()
  const start = new Date(now.getTime() - windowDays * 86_400_000)

  try {
    const records = await pb.collection('sky_events').getFullList<AtlasEvent>({
      filter: `starts_at >= "${start.toISOString().replace('T', ' ')}" && starts_at < "${now.toISOString().replace('T', ' ')}"`,
      sort: '-starts_at',
    })
    if (records.length > 0) return records
  } catch {
    // PocketBase unreachable -- fall through to the mock set below.
  }

  return MOCK_EVENTS.filter((event) => {
    const t = new Date(event.starts_at).getTime()
    return t >= start.getTime() && t < now.getTime()
  }).sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())
}

export interface EventDayGroup {
  key: string
  label: string
  events: AtlasEvent[]
}

const DAY_MS = 86_400_000

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function dayLabel(date: Date, today: Date): string {
  const diffDays = Math.round((startOfDay(date).getTime() - today.getTime()) / DAY_MS)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

// Groups an already-sorted (by starts_at) event list into day buckets,
// labeled Today/Tomorrow/weekday, in chronological order.
export function groupEventsByDay(events: AtlasEvent[]): EventDayGroup[] {
  const today = startOfDay(new Date())
  const groups = new Map<string, EventDayGroup>()

  for (const event of events) {
    const date = new Date(event.starts_at)
    const key = startOfDay(date).toISOString()
    let group = groups.get(key)
    if (!group) {
      group = { key, label: dayLabel(date, today), events: [] }
      groups.set(key, group)
    }
    group.events.push(event)
  }

  return Array.from(groups.values())
}
