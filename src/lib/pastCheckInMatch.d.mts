import type { SkyEvent } from './db'
import type { ConjunctionPair, IdentifiedObject } from './skyPhotoId'

/** Ordered, strongest first. A candidate is never `none` -- see `confidence` on the result. */
export type RankedConfidence = 'strong' | 'possible' | 'weak'

/** How sure the ranker is that the photo is of one of the day's real events. */
export type CheckInConfidence = RankedConfidence | 'none'

/** What `identifySky()` said about the frame. `skipped` means it had no opinion -- never a rejection. */
export type FrameVerdict = 'agrees' | 'disagrees' | 'skipped'

export interface RankedCandidate {
  event: SkyEvent
  confidence: RankedConfidence
  /** Distance to the observer, or null for an event with no coordinates (eclipses, showers). */
  distanceKm: number | null
  /** |event midpoint - photo instant|, or null when the photo had no trustworthy time. */
  timeDeltaMs: number | null
  frame: FrameVerdict
  /** Machine-readable codes, e.g. `frame-match`, `moon-phase-needs-frame`, `no-trustworthy-time`. */
  reasons: string[]
  /** Where the event's body sat, for the heading tie-break; null when there is nothing to point at. */
  azimuthDeg: number | null
}

export interface RankOptions {
  lat: number
  lon: number
  /**
   * The photo's instant, or null when its time could not be trusted (no EXIF
   * timestamp, or the user overrode the day) -- which is what produces the
   * `weak` band rather than an outright rejection.
   */
  instant?: Date | null
  headingDeg?: number | null
  /**
   * `identifySky()`'s result, or null when the frame was not analysed.
   *
   * Gate D reads `aboveHorizon` (everything up, heading-independent) rather
   * than `objects` (heading-filtered). It is optional only so a hand-built
   * fixture may omit it; `identifySky()` always sets it.
   */
  identified?: { aboveHorizon?: IdentifiedObject[]; objects: IdentifiedObject[]; closestPair: ConjunctionPair | null } | null
}

/** Kinds that reach the top band on time overlap alone, without frame corroboration. */
export const FLAGSHIP_KINDS: Set<string>

/** The bands a candidate can be in, strongest first. */
export const CONFIDENCE_ORDER: readonly RankedConfidence[]

export function rankPastEventCandidates(
  events: SkyEvent[],
  options: RankOptions,
): { confidence: CheckInConfidence; candidates: RankedCandidate[] }
