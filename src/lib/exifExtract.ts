// ASV-33: pull just what skyPhotoId.ts needs out of a photo's EXIF, fully
// client-side -- the image itself and its metadata never leave the device
// for this feature, which sidesteps the "how long do we retain GPS" privacy
// question raised in the ticket entirely (there's simply nothing to retain
// server-side unless the user separately chooses to save the result to
// their Journal).
import { parse } from 'exifr'

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
}

const EMPTY: PhotoExif = { dateTimeOriginal: null, timeZoneKnown: false, lat: null, lon: null, headingDeg: null }

// "2026:09:14 18:29:57" -- EXIF's own date separator is ':', including in
// the date portion, so this can't be handed to `new Date(...)` directly.
function parseExifDateTime(raw: unknown): { y: number; mo: number; d: number; h: number; mi: number; s: number } | null {
  if (typeof raw !== 'string') return null
  const match = raw.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/)
  if (!match) return null
  const [, y, mo, d, h, mi, s] = match.map(Number)
  return { y, mo, d, h, mi, s }
}

// "+08:00" / "-05:30" -> minutes east of UTC.
function parseOffsetMinutes(raw: unknown): number | null {
  if (typeof raw !== 'string') return null
  const match = raw.match(/^([+-])(\d{2}):(\d{2})$/)
  if (!match) return null
  const [, sign, h, m] = match
  const minutes = Number(h) * 60 + Number(m)
  return sign === '-' ? -minutes : minutes
}

export async function extractPhotoExif(file: File): Promise<PhotoExif> {
  try {
    // reviveValues: false keeps DateTimeOriginal/OffsetTimeOriginal as raw
    // strings (parsed manually below, timezone-aware) rather than exifr's
    // own Date conversion, which reads the naive "YYYY:MM:DD HH:MM:SS" text
    // using the *browser's* local timezone -- wrong whenever someone
    // uploads a photo from a different timezone than where it was taken.
    // The computed `latitude`/`longitude`/GPSImgDirection fields are
    // unaffected by this option and still come back normally.
    const tags = await parse(file, { gps: true, exif: true, reviveValues: false })
    if (!tags) return EMPTY

    const parsed = parseExifDateTime(tags.DateTimeOriginal)
    const offsetMinutes = parseOffsetMinutes(tags.OffsetTimeOriginal)
    let dateTimeOriginal: Date | null = null
    if (parsed) {
      // Treat the naive components as UTC, then subtract the known offset
      // to get the true UTC instant. With no offset, this is the raw
      // wall-clock reading misinterpreted as UTC -- a placeholder the
      // caller must show as editable/unconfirmed, not a real UTC instant.
      const utcMs = Date.UTC(parsed.y, parsed.mo - 1, parsed.d, parsed.h, parsed.mi, parsed.s)
      dateTimeOriginal = new Date(utcMs - (offsetMinutes ?? 0) * 60_000)
    }

    return {
      dateTimeOriginal,
      timeZoneKnown: offsetMinutes != null,
      lat: typeof tags.latitude === 'number' ? tags.latitude : null,
      lon: typeof tags.longitude === 'number' ? tags.longitude : null,
      headingDeg: typeof tags.GPSImgDirection === 'number' ? tags.GPSImgDirection : null,
    }
  } catch {
    // Stripped/corrupt/unsupported EXIF -- treated the same as "no EXIF"
    // by the caller, which prompts for manual time/location instead.
    return EMPTY
  }
}
