// Shared clock for list rows and the event detail page.
//
// Meteor showers are stored as a wide UTC window (meteor-showers.mjs: the
// catalogue peak is 18h after starts_at). Formatting that window start made
// the hub say "Tue Oct 20, 17:00" while the detail, in the browser's zone,
// said "Wed Oct 21" and "5:00 PM" — against copy that says the shower is best
// after midnight. The display instant for a shower is 02:00 on the catalogue
// peak date in the observer's zone. Every other event keeps its start instant.
// Both surfaces format that instant in the same zone and append the abbreviation.

export const METEOR_PEAK_OFFSET_MS = 18 * 3_600_000

export function meteorPeakInstant(startsAtIso) {
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

export function meteorBestViewingInstant(startsAtIso, timeZone) {
  const peak = meteorPeakInstant(startsAtIso)
  if (!timeZone) return peak
  try {
    // The catalogue peak is a UTC calendar date (Orionids: 21 Oct 04:00 UTC),
    // not "whatever local date that instant falls on". 02:00 on that UTC date
    // in the observer's zone is the pre-dawn of the named peak, including for
    // zones behind UTC where the peak instant itself is still the evening before.
    return zonedWallTimeToUtc(peak.getUTCFullYear(), peak.getUTCMonth() + 1, peak.getUTCDate(), 2, 0, timeZone)
  } catch {
    return peak
  }
}

export function eventDisplayInstant(event, timeZone) {
  if (event?.kind === 'meteor_shower') return meteorBestViewingInstant(event.startsAt, timeZone)
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
