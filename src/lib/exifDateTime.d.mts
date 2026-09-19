/** The pieces of an EXIF datetime, before any timezone is applied. */
export interface ExifDateTimeParts {
  y: number
  mo: number
  d: number
  h: number
  mi: number
  s: number
}

/** Where the camera's UTC offset came from. `unknown` means it could not be derived. */
export type OffsetSource = 'exif-offset' | 'gps-utc-pair' | 'longitude' | 'unknown'

/** Which evidence decided the civil day. `user` means Atlas could not and the person must pick. */
export type PhotoDaySource = 'exif' | 'gps' | 'longitude' | 'user'

/** Parse EXIF's `2026:09:14 18:29:57` (colons in the date portion). Null when unparseable. */
export function parseExifDateTime(raw: unknown): ExifDateTimeParts | null

/** `+08:00` / `-05:30` -> minutes east of UTC. Null for anything else. */
export function parseOffsetMinutes(raw: unknown): number | null

/** The naive wall-clock reading of `parsed` as if it were UTC. */
export function naiveUtcMs(parsed: ExifDateTimeParts | null): number | null

/**
 * `GPSDateStamp` + `GPSTimeStamp` (always UTC) -> the true UTC instant. The one
 * EXIF pair that cannot be wrong about the timezone.
 */
export function parseGpsUtcPair(dateStamp: unknown, timeStamp: unknown): number | null

/**
 * The camera's UTC offset, best evidence first: `OffsetTimeOriginal`, then the
 * GPS UTC pair, then `round(lon / 15)` hours, then nothing.
 */
export function deriveOffset(input: {
  explicitOffsetMinutes?: number | null
  naiveUtcMs?: number | null
  gpsUtcMs?: number | null
  longitudeDeg?: number | null
}): { offsetMinutes: number | null; offsetSource: OffsetSource }

export interface ResolvedPhotoDay {
  /** The civil day where the photo was taken. Null only when there was no usable timestamp. */
  dayKey: string | null
  /** The other plausible day when `ambiguous` -- drives the two-chip prompt. */
  dayKeyAlt: string | null
  source: PhotoDaySource
  /**
   * True when the camera's zone and the photo's zone disagree about the date,
   * or when the offset is inexact and the local time is within 3h of midnight.
   * The date is a judgement call and must be confirmed, never silently chosen.
   */
  ambiguous: boolean
  /** The true UTC instant, when it could be recovered. */
  utcMs: number | null
  /** Local hour at the photo's location, 0-23. */
  localHour: number | null
}

/** The civil day a photo belongs to, and how sure Atlas is of it. */
export function resolvePhotoDay(input: {
  naiveUtcMs?: number | null
  offsetMinutes?: number | null
  offsetSource?: OffsetSource
  longitudeDeg?: number | null
}): ResolvedPhotoDay
