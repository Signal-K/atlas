// Ranked target selector (AT epic 1, task 3): turns tonight's cached
// SkyEvents + weather + real-time moon illumination into a TonightScore
// plus up to 3 phone-friendly targets. Reads from Dexie via sync.ts helpers
// only, so it works offline from whatever was last synced.
import * as Astronomy from 'astronomy-engine'
import { getEventsInRange } from './sync'
import type { SkyEvent } from './db'
import { fetchViewingAdvisory } from './weather'
import { scoreTonight, type TonightRating } from './tonightScore'
import { bodyForTarget, getHorizontalPosition, type HorizontalPosition } from './skyPosition'

export type TargetDifficulty = 'easy' | 'moderate' | 'hard'

export interface TonightTarget {
  eventId: string
  title: string
  kind: string
  bestTime: string // ISO
  difficulty: TargetDifficulty
  phoneFriendly: boolean
  reason: string
  direction: HorizontalPosition | null
}

export interface DarknessWindow {
  civilDuskAt: string | null
  astronomicalDuskAt: string | null
  astronomicalDawnAt: string | null
  civilDawnAt: string | null
}

export interface TonightPlan {
  rating: TonightRating
  reasons: string[]
  targets: TonightTarget[]
  moonIlluminationPct: number
  darknessWindow: DarknessWindow
  weatherAvailable: boolean
}

interface KindMeta {
  priority: number
  difficulty: TargetDifficulty
  phoneFriendly: boolean
  reason: string
}

// Lower priority number = shown first. Kinds not listed (night_sky_guide,
// local_night_sky, galaxy/nebula/cluster raw kinds) fall through to the
// generic default below and are deprioritised: they're only worth
// surfacing over a real event on an otherwise quiet night.
const KIND_META: Record<string, KindMeta> = {
  eclipse: { priority: 1, difficulty: 'moderate', phoneFriendly: true, reason: 'A dramatic, unmistakable sky event worth planning around.' },
  moon_phase: { priority: 2, difficulty: 'easy', phoneFriendly: true, reason: 'Bright and easy to frame with any phone camera.' },
  iss_pass: { priority: 3, difficulty: 'easy', phoneFriendly: true, reason: 'Naked-eye visible; a wide-angle long exposure catches its trail.' },
  conjunction: { priority: 4, difficulty: 'moderate', phoneFriendly: true, reason: 'Two bright objects close together — a great wide-field phone shot.' },
  planet_event: { priority: 5, difficulty: 'moderate', phoneFriendly: true, reason: 'A bright point of light — a steady tripod shot will pick it out.' },
  meteor_shower: { priority: 6, difficulty: 'hard', phoneFriendly: false, reason: 'Needs a dark sky and patience; a phone can catch bright fireballs at best.' },
  deep_sky: { priority: 7, difficulty: 'hard', phoneFriendly: false, reason: 'Faint — only worth a phone attempt on a clear, dark, moonless night.' },
}

const DEFAULT_META: KindMeta = { priority: 9, difficulty: 'hard', phoneFriendly: false, reason: 'A niche target for tonight.' }

// Kinds bright enough that moon glare barely matters, used to decide
// whether TonightScore should penalise a bright moon.
const BRIGHT_KINDS = new Set(['moon_phase', 'iss_pass', 'planet_event', 'conjunction', 'eclipse'])

// Kinds whose event.startsAt is an annual/multi-day marker rather than a
// precise "look now" moment (e.g. a planet's opposition date), so tonight's
// actual best time is its meridian transit instead. Deep-sky objects would
// benefit too, but they don't have a resolvable astronomy-engine body/RA-dec
// stored on the event yet, so transit-time for them is deferred.
const TRANSIT_KINDS = new Set(['planet_event'])

// Below this altitude a target is likely behind buildings/trees/hills --
// same threshold the ISS pass ingest (scripts/sources/iss-passes.mjs) uses
// to decide a pass is worth surfacing at all.
const LOW_ALTITUDE_DEG = 20

function metaFor(kind: string): KindMeta {
  return KIND_META[kind] ?? DEFAULT_META
}

// "Tonight" runs from now until 6am the next morning -- generous enough to
// cover both an early-evening check-in and a post-midnight one.
function tonightWindow(now: Date): { start: Date; end: Date } {
  const end = new Date(now)
  end.setDate(end.getDate() + 1)
  end.setHours(6, 0, 0, 0)
  return { start: now, end }
}

// Civil (-6°) and astronomical (-18°) dusk/dawn tonight, used both as a
// TonightScore-adjacent signal and to tell camera-recipe features when it's
// twilight vs. genuinely dark. Returns nulls near the poles in summer, where
// the Sun may never reach these altitudes -- callers should treat that as
// "no confirmed twilight/darkness boundary."
function getDarknessWindow(lat: number, lon: number, start: Date, end: Date): DarknessWindow {
  const observer = new Astronomy.Observer(lat, lon, 0)
  const limitDays = (end.getTime() - start.getTime()) / 86_400_000
  const search = (direction: number, altitude: number) => {
    const result = Astronomy.SearchAltitude(Astronomy.Body.Sun, observer, direction, start, limitDays, altitude)
    return result ? result.date.toISOString() : null
  }
  return {
    civilDuskAt: search(-1, -6),
    astronomicalDuskAt: search(-1, -18),
    astronomicalDawnAt: search(1, -18),
    civilDawnAt: search(1, -6),
  }
}

// For kinds where the raw event timestamp isn't "when to actually look"
// tonight, finds the body's meridian transit (highest, best-altitude point)
// within the tonight window. Falls back to the raw timestamp if the body
// can't be resolved or never transits during the window.
function resolveBestTime(event: SkyEvent, lat: number, lon: number, start: Date, end: Date): Date {
  if (!TRANSIT_KINDS.has(event.kind)) return new Date(event.startsAt)

  const body = bodyForTarget(event.kind, event.target)
  if (!body) return new Date(event.startsAt)

  const observer = new Astronomy.Observer(lat, lon, 0)
  const transit = Astronomy.SearchHourAngle(body, observer, 0, start, 1)
  const transitDate = transit.time.date
  if (transitDate < start || transitDate > end) return new Date(event.startsAt)
  return transitDate
}

function rankTargets(events: SkyEvent[], rating: TonightRating, lat: number, lon: number, start: Date, end: Date): TonightTarget[] {
  if (rating === 'skip') return []

  return [...events]
    .map((event) => {
      const bestTime = resolveBestTime(event, lat, lon, start, end)
      const body = bodyForTarget(event.kind, event.target)
      const direction = body ? getHorizontalPosition(body, bestTime, lat, lon) : null
      return { event, bestTime, direction }
    })
    .sort((a, b) => {
      const priorityDiff = metaFor(a.event.kind).priority - metaFor(b.event.kind).priority
      if (priorityDiff !== 0) return priorityDiff
      // Within the same kind priority, demote near-horizon targets (likely
      // blocked by buildings/trees) below ones genuinely high in the sky.
      const aLow = (a.direction?.altitudeDeg ?? 90) < LOW_ALTITUDE_DEG ? 1 : 0
      const bLow = (b.direction?.altitudeDeg ?? 90) < LOW_ALTITUDE_DEG ? 1 : 0
      if (aLow !== bLow) return aLow - bLow
      return a.event.startsAt.localeCompare(b.event.startsAt)
    })
    .slice(0, 3)
    .map(({ event, bestTime, direction }) => {
      const meta = metaFor(event.kind)
      return {
        eventId: event.id,
        title: event.title,
        kind: event.kind,
        bestTime: bestTime.toISOString(),
        difficulty: meta.difficulty,
        phoneFriendly: meta.phoneFriendly,
        reason: meta.reason,
        direction,
      }
    })
}

export async function getTonightPlan(lat: number, lon: number, now = new Date()): Promise<TonightPlan> {
  const { start, end } = tonightWindow(now)

  const [events, advisory] = await Promise.all([
    getEventsInRange(start, end),
    fetchViewingAdvisory(lat, lon, 1).catch(() => []),
  ])

  const today = advisory[0]
  const weatherAvailable = today != null
  const moonIlluminationPct = Astronomy.Illumination(Astronomy.Body.Moon, now).phase_fraction * 100
  const hasBrightTarget = events.some((event) => BRIGHT_KINDS.has(event.kind))

  // When the forecast can't be reached (offline, or Open-Meteo down), don't
  // fall back to "assume worst-case clouds" -- that would tell an offline
  // user "skip, fully clouded" when the truth is just "we don't know."
  // Cap the rating at 'maybe' instead, based only on what events exist.
  const { rating, reasons } = weatherAvailable
    ? scoreTonight({
        cloudCoverPct: today.cloudCoverPct,
        precipitationChancePct: today.precipitationChancePct,
        moonIlluminationPct,
        hasBrightTarget,
      })
    : {
        rating: 'maybe' as TonightRating,
        reasons: ['Weather forecast unavailable while offline — rating is based on cached events only, check the sky yourself.'],
      }

  const darknessWindow = getDarknessWindow(lat, lon, start, end)

  return {
    rating,
    reasons,
    targets: rankTargets(events, rating, lat, lon, start, end),
    moonIlluminationPct,
    darknessWindow,
    weatherAvailable,
  }
}
