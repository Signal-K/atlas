// Shared clock for list rows and the event detail page.
//
// Most showers are stored as a wide UTC window whose catalogue peak is 18h
// after starts_at. The Orionids are the exception: the stored window is the
// whole activity (19 Oct–8 Nov 2026), while the peak night stays 21–22 Oct.
// With coordinates, the display instant is the first dark, radiant-up moment
// after moonset on that peak night. Without coordinates, other showers stay
// at 02:00 local on the catalogue peak's UTC date, and the Orionids use
// 02:00 local on the morning after that date (22 Oct). Every other event
// keeps its start instant. Both surfaces format that instant in the same
// zone and append the abbreviation.

import { meteorMoonFreeInstant } from './eventVisibility.mjs'

export const METEOR_PEAK_OFFSET_MS = 18 * 3_600_000

export function meteorPeakInstant(startsAtIso, target) {
  if (target === 'orionids') {
    const start = new Date(startsAtIso)
    // activeStart is 19 Oct of the peak year, so the UTC year of starts_at is
    // the year of the 21 Oct 04:00 UTC catalogue peak. Do not use start+18h
    // or the long activity window moves the peak to 19 Oct.
    return new Date(Date.UTC(start.getUTCFullYear(), 9, 21, 4, 0, 0))
  }
  return new Date(new Date(startsAtIso).getTime() + METEOR_PEAK_OFFSET_MS)
}

function partsAt(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]))
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  }
}

function offsetAt(date, timeZone) {
  const parts = partsAt(date, timeZone)
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

export function zonedWallTimeToUtc(year, month, day, hour, minute, timeZone) {
  const wall = Date.UTC(year, month - 1, day, hour, minute, 0)
  let candidate = new Date(wall)
  candidate = new Date(wall - offsetAt(candidate, timeZone))
  return new Date(wall - offsetAt(candidate, timeZone))
}

export function meteorBestViewingInstant(startsAtIso, timeZone, coords, target) {
  const peak = meteorPeakInstant(startsAtIso, target)
  if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lon)) {
    try {
      const moonFree = meteorMoonFreeInstant(target, peak, coords.lat, coords.lon)
      if (moonFree) return moonFree
    } catch {
      // Fall through to the civil-time hint when the ephemeris cannot run.
    }
  }
  if (!timeZone) return peak
  try {
    // Orionids: 02:00 local on the morning after the catalogue peak UTC date
    // (22 Oct), which is the practical stand-in for "after moonset". Other
    // showers keep 02:00 on the peak's own UTC date.
    const day = target === 'orionids' ? peak.getUTCDate() + 1 : peak.getUTCDate()
    const morning = new Date(Date.UTC(peak.getUTCFullYear(), peak.getUTCMonth(), day))
    return zonedWallTimeToUtc(morning.getUTCFullYear(), morning.getUTCMonth() + 1, morning.getUTCDate(), 2, 0, timeZone)
  } catch {
    return peak
  }
}

export function eventDisplayInstant(event, timeZone, coords) {
  if (event?.kind === 'meteor_shower') return meteorBestViewingInstant(event.startsAt, timeZone, coords, event.target)
  return new Date(event.startsAt)
}

export function timeZoneAbbreviation(iso, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      ...(timeZone ? { timeZone } : {}),
      hour: 'numeric',
      timeZoneName: 'short',
    }).formatToParts(new Date(iso))
    return parts.find((part) => part.type === 'timeZoneName')?.value ?? ''
  } catch {
    return ''
  }
}

export function formatZonedDate(iso, timeZone) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(timeZone ? { timeZone } : {}),
  })
}

export function formatZonedTime(iso, timeZone, hour12 = false) {
  if (!iso) return '—'
  const time = new Date(iso).toLocaleTimeString(undefined, {
    hour: hour12 ? 'numeric' : '2-digit',
    minute: '2-digit',
    hour12,
    ...(timeZone ? { timeZone } : {}),
  })
  const zone = timeZoneAbbreviation(iso, timeZone)
  return zone ? `${time} ${zone}` : time
}
