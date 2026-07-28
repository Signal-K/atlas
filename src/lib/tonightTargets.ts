// Ranked target selector (AT epic 1, task 3): turns tonight's cached
// SkyEvents + weather + real-time moon illumination into a TonightScore
// plus up to 3 phone-friendly targets. Reads from Dexie via sync.ts helpers
// only, so it works offline from whatever was last synced.
import * as Astronomy from 'astronomy-engine'
import { getEventsInRange } from './sync'
import type { SkyEvent } from './db'
import { fetchViewingForecast, findNextClearWindow, type DailyViewingAdvisory } from './weather'
import { scoreTonight, type TonightRating } from './tonightScore'
import { bodyForTarget, type HorizontalPosition } from './skyPosition'
import { getPrimarySkyMapObjectForEvent } from './skyMapLayers'
import { haversineKm } from './cities'
import { tonightWindowForTimeZone } from './timeZone'
import { getDarknessWindow, type DarknessWindow } from './darknessWindow'

export { getDarknessWindow }
export type { DarknessWindow }

export type TargetDifficulty = 'easy' | 'moderate' | 'hard'

export interface TonightTarget {
  eventId: string
  title: string
  kind: string
  bestTime: string // ISO
  difficulty: TargetDifficulty
  phoneFriendly: boolean
  // Distinct from phoneFriendly/difficulty: some kinds are a poor phone
  // target (meteor showers) but still great naked-eye stargazing, and vice
  // versa (the Moon is phone-friendly but adds nothing to naked-eye viewing
  // beyond just looking up). Lets the UI serve "just want to look up
  // tonight" users, not only people trying to get a phone photo.
  nakedEyeVisible: boolean
  reason: string
  // Tonight-specific viewing note derived from today's actual cloud cover
  // forecast, independent of the kind's static `reason` -- so a "hard"
  // target still gets an honest, concrete "is it worth a look tonight"
  // signal instead of only ever reading as discouraging.
  viewingNote: string
  direction: HorizontalPosition | null
}

export interface GeneralPhotoWindow {
  startsAt: string // ISO
  endsAt: string // ISO
  reason: string
}

export interface TonightPlan {
  timeZone?: string
  rating: TonightRating
  reasons: string[]
  targets: TonightTarget[]
  moonIlluminationPct: number
  darknessWindow: DarknessWindow
  weatherAvailable: boolean
  // Tonight's own forecast day, and, when tonight is cloudy, the nearest
  // upcoming night worth waiting for instead (STS-319's plan-screen weather
  // section). Both null when the forecast couldn't be reached.
  todayAdvisory: DailyViewingAdvisory | null
  nextClearWindow: DailyViewingAdvisory | null
  // Best window tonight for a general "just point my phone at the sky"
  // photo -- independent of any specific event target, for users who don't
  // have (or don't want) a particular thing to photograph. Null only when
  // no darkness window could be resolved at all (near the poles in summer).
  generalPhotoWindow: GeneralPhotoWindow | null
}

interface KindMeta {
  priority: number
  difficulty: TargetDifficulty
  phoneFriendly: boolean
  nakedEyeVisible: boolean
  reason: string
}

// Lower priority number = shown first. Kinds not listed (night_sky_guide,
// local_night_sky, galaxy/nebula/cluster raw kinds) fall through to the
// generic default below and are deprioritised: they're only worth
// surfacing over a real event on an otherwise quiet night.
const KIND_META: Record<string, KindMeta> = {
  eclipse: {
    priority: 1,
    difficulty: 'moderate',
    phoneFriendly: true,
    nakedEyeVisible: true,
    reason: 'A dramatic, unmistakable sky event worth planning around.',
  },
  moon_phase: {
    priority: 2,
    difficulty: 'easy',
    phoneFriendly: true,
    nakedEyeVisible: true,
    reason: 'Bright and easy to frame with any phone camera.',
  },
  iss_pass: {
    priority: 3,
    difficulty: 'easy',
    phoneFriendly: true,
    nakedEyeVisible: true,
    reason: 'Naked-eye visible; a wide-angle long exposure catches its trail.',
  },
  conjunction: {
    priority: 4,
    difficulty: 'moderate',
    phoneFriendly: true,
    nakedEyeVisible: true,
    reason: 'Two bright objects close together — a great wide-field phone shot.',
  },
  planet_event: {
    priority: 5,
    difficulty: 'moderate',
    phoneFriendly: true,
    nakedEyeVisible: true,
    reason: 'A bright point of light — a steady tripod shot will pick it out.',
  },
  meteor_shower: {
    priority: 6,
    difficulty: 'hard',
    phoneFriendly: false,
    nakedEyeVisible: true,
    reason: 'Needs a dark sky and patience; a phone can catch bright fireballs at best, but naked-eye it needs no gear at all.',
  },
  deep_sky: {
    priority: 7,
    difficulty: 'hard',
    phoneFriendly: false,
    nakedEyeVisible: false,
    reason: 'Faint — only worth a phone attempt on a clear, dark, moonless night, and usually needs binoculars or a scope to see at all.',
  },
  satellite_flare: {
    priority: 3,
    difficulty: 'easy',
    phoneFriendly: true,
    nakedEyeVisible: true,
    reason: 'A bright, fast-moving point (or line, for a Starlink train) of light — a wide-angle long exposure catches its trail.',
  },
  aurora: {
    priority: 1,
    difficulty: 'moderate',
    phoneFriendly: true,
    nakedEyeVisible: true,
    reason: 'A phone in night mode on a tripod often picks up aurora colour the naked eye can barely see.',
  },
  comet: {
    priority: 8,
    difficulty: 'hard',
    phoneFriendly: false,
    nakedEyeVisible: false,
    reason: 'Most comets need binoculars or a small scope — only rare, exceptionally bright ones are naked-eye visible.',
  },
  asteroid_approach: {
    priority: 8,
    difficulty: 'hard',
    phoneFriendly: false,
    nakedEyeVisible: false,
    reason: 'Too faint for the naked eye or a phone — this one needs a tracked telescope exposure to actually image.',
  },
  fireball: {
    priority: 9,
    difficulty: 'hard',
    phoneFriendly: false,
    nakedEyeVisible: false,
    reason: 'Already happened — a record of recent activity, not something to go outside for tonight.',
  },
  solar_flare: {
    priority: 9,
    difficulty: 'hard',
    phoneFriendly: false,
    nakedEyeVisible: false,
    reason: 'Not directly observable — worth knowing about because it can trigger aurora a day or two later.',
  },
}

const DEFAULT_META: KindMeta = {
  priority: 9,
  difficulty: 'hard',
  phoneFriendly: false,
  nakedEyeVisible: false,
  reason: 'A niche target for tonight.',
}

// Kinds bright enough that moon glare barely matters, used to decide
// whether TonightScore should penalise a bright moon.
const BRIGHT_KINDS = new Set(['moon_phase', 'iss_pass', 'satellite_flare', 'planet_event', 'conjunction', 'eclipse'])

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

// Generous rather than a hard "top 3" -- a night with several scheduled
// events (e.g. a meteor shower plus a couple of ISS passes) shouldn't have
// most of them silently dropped. Still capped so the list doesn't sprawl
// on an exceptionally busy night.
const MAX_TARGETS = 8

// Events with no latitude/longitude (moon phases, meteor showers, eclipses,
// conjunctions, planets, comets, aurora, the generic night-sky guide) are
// visible from anywhere and always pass through. Events that do carry a
// latitude/longitude (ISS/satellite passes, the Melbourne-specific
// local_night_sky fallback content) are seeded at one specific city's exact
// coordinates, so they're only relevant to a viewer actually near that
// city -- getEventsInRange has no location filtering of its own (by design:
// other views like the calendar and Dashboard's "browse the world" want the
// full unfiltered list), so "tonight near me" has to filter here instead.
const LOCATION_MATCH_RADIUS_KM = 80

function isLocationRelevant(event: SkyEvent, lat: number, lon: number): boolean {
  if (event.latitude == null || event.longitude == null) return true
  return haversineKm({ lat, lon }, { lat: event.latitude, lon: event.longitude }) <= LOCATION_MATCH_RADIUS_KM
}

// Aurora events are stored as a global (no lat/lon) SkyEvent, like moon
// phases -- but unlike moon phases, whether one is actually relevant
// depends entirely on the viewer's own latitude. The minimum geomagnetic
// latitude for visibility at that event's forecast Kp is encoded in its
// `target` (e.g. "aurora_lat55") by scripts/sources/aurora.mjs, since
// adding a dedicated numeric column would mean a schema change. Geographic
// latitude is used here as a stand-in for geomagnetic latitude -- close
// enough for a rule-of-thumb "is this worth surfacing" filter, not exact.
function isAuroraRelevant(event: SkyEvent, lat: number): boolean {
  if (event.kind !== 'aurora') return true
  const match = /^aurora_lat(\d+)/.exec(event.target)
  if (!match) return true
  return Math.abs(lat) >= Number(match[1])
}

function viewingNoteFor(cloudCoverPct: number | null): string {
  if (cloudCoverPct == null) return 'Cloud cover forecast unavailable — check the sky yourself.'
  if (cloudCoverPct < 30) return 'Low cloud cover tonight — good chance of spotting this.'
  if (cloudCoverPct < 70) return 'Partly cloudy tonight — worth a look between clouds.'
  return 'High cloud cover tonight — likely obscured, but worth checking for gaps.'
}

// Best window tonight to just point a phone at the sky generally, for
// stargazers/photographers without a specific target in mind. Prefers the
// astronomical-dark window (genuinely dark sky); falls back to the full
// civil-dusk-to-dawn span when astronomical dusk/dawn can't be resolved
// (near the poles in summer, per getDarknessWindow's own caveat).
function getGeneralPhotoWindow(
  darknessWindow: DarknessWindow,
  moonIlluminationPct: number,
  cloudCoverPct: number | null,
): GeneralPhotoWindow | null {
  const startsAt = darknessWindow.astronomicalDuskAt ?? darknessWindow.civilDuskAt
  const endsAt = darknessWindow.astronomicalDawnAt ?? darknessWindow.civilDawnAt
  if (!startsAt || !endsAt) return null

  const moonReason =
    moonIlluminationPct < 25
      ? 'The Moon is faint or below the horizon — the darkest window tonight, great for a wide starfield or Milky Way shot.'
      : moonIlluminationPct > 75
        ? 'The Moon is bright tonight — better for a moonlit-landscape shot than faint stars, but still worth being out.'
        : 'Moderate moonlight tonight — some fainter stars will wash out, but bright targets and the Moon itself will frame well.'

  const cloudSuffix =
    cloudCoverPct == null
      ? ' Cloud cover forecast unavailable — check the sky yourself.'
      : cloudCoverPct < 30
        ? ' Low cloud cover forecast — good conditions.'
        : cloudCoverPct < 70
          ? ' Partly cloudy forecast — worth a look, but have a backup night in mind.'
          : ' High cloud cover forecast — may not be worth it tonight.'

  return { startsAt, endsAt, reason: moonReason + cloudSuffix }
}

function rankTargets(
  events: SkyEvent[],
  rating: TonightRating,
  lat: number,
  lon: number,
  start: Date,
  end: Date,
  cloudCoverPct: number | null,
): TonightTarget[] {
  if (rating === 'skip') return []

  return events
    .filter((event) => isAuroraRelevant(event, lat))
    .map((event) => {
      const bestTime = resolveBestTime(event, lat, lon, start, end)
      const primaryObject = getPrimarySkyMapObjectForEvent(event, bestTime, lat, lon)
      const direction = primaryObject
        ? {
            altitudeDeg: primaryObject.altitudeDeg,
            azimuthDeg: primaryObject.azimuthDeg,
            compassLabel: primaryObject.compassLabel,
          }
        : null
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
    .slice(0, MAX_TARGETS)
    .map(({ event, bestTime, direction }) => {
      const meta = metaFor(event.kind)
      return {
        eventId: event.id,
        title: event.title,
        kind: event.kind,
        bestTime: bestTime.toISOString(),
        difficulty: meta.difficulty,
        phoneFriendly: meta.phoneFriendly,
        nakedEyeVisible: meta.nakedEyeVisible,
        reason: meta.reason,
        viewingNote: viewingNoteFor(cloudCoverPct),
        direction,
      }
    })
}

export async function getTonightPlan(lat: number, lon: number, now = new Date(), locationTimeZone?: string): Promise<TonightPlan> {
  const forecast = await fetchViewingForecast(lat, lon, 7).catch(() => ({ days: [], timeZone: undefined }))
  const advisory = forecast.days
  const { start, end } = tonightWindowForTimeZone(now, locationTimeZone ?? forecast.timeZone)
  const allEvents = await getEventsInRange(start, end)
  const events = allEvents.filter((event) => isLocationRelevant(event, lat, lon))

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
  const cloudCoverPct = weatherAvailable ? today.cloudCoverPct : null

  return {
    timeZone: locationTimeZone ?? forecast.timeZone,
    rating,
    reasons,
    targets: rankTargets(events, rating, lat, lon, start, end, cloudCoverPct),
    moonIlluminationPct,
    darknessWindow,
    weatherAvailable,
    todayAdvisory: today ?? null,
    nextClearWindow: today && today.quality === 'cloudy' ? findNextClearWindow(advisory) : null,
    generalPhotoWindow: getGeneralPhotoWindow(darknessWindow, moonIlluminationPct, cloudCoverPct),
  }
}
