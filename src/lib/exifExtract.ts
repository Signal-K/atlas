// ASV-33: pull just what skyPhotoId.ts needs out of a photo's EXIF, fully
// client-side -- the image itself and its metadata never leave the device
// for this feature, which sidesteps the "how long do we retain GPS" privacy
// question raised in the ticket entirely (there's simply nothing to retain
// server-side unless the user separately chooses to save the result to
// their Journal).
//
// The date arithmetic is NOT here. It lives in exifDateTime.mjs, which is pure
// and importable by the `node --test` suite -- a `.mjs` file can be imported by
// a test where a `.ts` file cannot. Deciding which civil day a photo belongs to
// is the highest-risk calculation in the backdated-check-in feature, so it is
// the part that has to be pinned by tests. This module's job is now only to get
// the raw EXIF tags out of the file and hand them over.
import { parse } from 'exifr'
import {
  deriveOffset,
  naiveUtcMs,
  parseExifDateTime,
  parseGpsUtcPair,
  parseOffsetMinutes,
  type OffsetSource,
} from './exifDateTime.mjs'

export interface PhotoExif {
  dateTimeOriginal: Date | null
  // False when DateTimeOriginal had no OffsetTimeOriginal alongside it --
  // the overwhelming common case (most phones don't write it). Sky
  // positions are time-sensitive enough that a wrong timezone assumption
  // meaningfully changes the result, so the caller surfaces this and lets
  // the person confirm/correct the time rather than trusting it silently.
  timeZoneKnown: boolean
  lat: number | null
  lon: number | null
  // GPSImgDirection: compass heading the camera was pointed, 0-360.
  headingDeg: number | null
  // Added for backdated check-ins. `gpsUtc` is the one EXIF value that cannot
  // be wrong about the timezone (GPSDateStamp + GPSTimeStamp are stored UTC),
  // so it stays available as the fallback when the offset has to be derived
  // rather than read. `offsetMinutes`/`offsetSource` record what was decided
  // and on what evidence, which the sheet shows and the entry stores.
  gpsUtc: Date | null
  offsetMinutes: number | null
  offsetSource: OffsetSource
}

const EMPTY: PhotoExif = {
  dateTimeOriginal: null,
  timeZoneKnown: false,
  lat: null,
  lon: null,
  headingDeg: null,
  gpsUtc: null,
  offsetMinutes: null,
  offsetSource: 'unknown',
}

export async function extractPhotoExif(file: File): Promise<PhotoExif> {
  try {
    // reviveValues: false keeps DateTimeOriginal/OffsetTimeOriginal as raw
    // strings (parsed in exifDateTime.mjs, timezone-aware) rather than exifr's
    // own Date conversion, which reads the naive "YYYY:MM:DD HH:MM:SS" text
    // using the *browser's* local timezone -- wrong whenever someone
    // uploads a photo from a different timezone than where it was taken.
    // The computed `latitude`/`longitude`/GPSImgDirection fields are
    // unaffected by this option and still come back normally.
    const tags = await parse(file, { gps: true, exif: true, reviveValues: false })
    if (!tags) return EMPTY

    const parsed = parseExifDateTime(tags.DateTimeOriginal)
    const naive = naiveUtcMs(parsed)

    const lat = typeof tags.latitude === 'number' ? tags.latitude : null
    const lon = typeof tags.longitude === 'number' ? tags.longitude : null

    const gpsUtcMs = parseGpsUtcPair(tags.GPSDateStamp, tags.GPSTimeStamp)
    const { offsetMinutes, offsetSource } = deriveOffset({
      explicitOffsetMinutes: parseOffsetMinutes(tags.OffsetTimeOriginal),
      naiveUtcMs: naive,
      gpsUtcMs,
      // Only fed in when there is a longitude to feed it: deriveOffset treats
      // `longitudeDeg` as present-or-absent evidence, and passing NaN or a
      // placeholder zero would silently claim the photo was taken at Greenwich.
      longitudeDeg: lon,
    })

    // The true UTC instant. Reading the naive components as UTC and then
    // subtracting the offset is the only safe direction: with no known offset
    // this is the raw wall-clock reading misinterpreted as UTC, which the
    // caller must show as editable rather than treat as real.
    const dateTimeOriginal = naive != null ? new Date(naive - (offsetMinutes ?? 0) * 60_000) : null

    return {
      dateTimeOriginal,
      // Unchanged meaning: was an offset *read*, not derived. A derived offset
      // is good enough to match with but not good enough to stop asking.
      timeZoneKnown: offsetSource === 'exif-offset',
      lat,
      lon,
      headingDeg: typeof tags.GPSImgDirection === 'number' ? tags.GPSImgDirection : null,
      gpsUtc: gpsUtcMs != null ? new Date(gpsUtcMs) : null,
      offsetMinutes,
      offsetSource,
    }
  } catch {
    // Stripped/corrupt/unsupported EXIF -- treated the same as "no EXIF"
    // by the caller, which prompts for manual time/location instead.
    return EMPTY
  }
}
