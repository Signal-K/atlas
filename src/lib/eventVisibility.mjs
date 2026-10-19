import * as Astronomy from 'astronomy-engine'

// Visibility is deliberately an observer-time decision. Ingest can tell us
// that an event exists; only the viewer's coordinates and local sky can tell
// us whether it is observable there.
const METEOR_RADIANTS = {
  quadrantids: [15.33, 49],
  lyrids: [18.08, 34],
  eta_aquariids: [22.53, -1],
  perseids: [3.2, 58],
  orionids: [6.33, 16],
  leonids: [10.13, 22],
  geminids: [7.47, 33],
  ursids: [14.45, 76],
}

function position(body, date, lat, lon) {
  const observer = new Astronomy.Observer(lat, lon, 0)
  const equator = Astronomy.Equator(body, date, observer, true, true)
  return Astronomy.Horizon(date, observer, equator.ra, equator.dec, 'normal').altitude
}

function sunAltitude(date, lat, lon) {
  return position(Astronomy.Body.Sun, date, lat, lon)
}

// Point-in-time events (conjunction closest-approach, moon_phase peak,
// planet_event best time) all come from their source plugins with
// starts_at === ends_at -- a single exact instant, not a viewing window.
// Sampling only that instant is fragile: the mathematically-exact peak can
// land in daylight or with the bodies below the horizon even though the
// event is genuinely visible for hours around it that same evening (ASV-34
// found this exact failure for a real Moon-Venus conjunction -- 5.87deg at
// one midnight sample, 6.26deg at the next, either side of a 0.5deg minimum
// hours in between). Widen zero-duration events to a +/-6h window instead
// of trusting the single instant.
// Exported because the past-check-in matcher has to apply the same widening
// when deciding whether an instant falls "during" an event. Almost every
// historical candidate the matcher sees -- moon_phase, planet_event,
// conjunction -- ships with starts_at === ends_at, so a naive containment
// check matches nothing at all and a photo of a real Moon-Venus conjunction
// would fall through to the review queue.
export const POINT_EVENT_WINDOW_HOURS = 6

function samples(event) {
  const start = new Date(event.startsAt).getTime()
  const end = new Date(event.endsAt || event.startsAt).getTime()
  const span = Math.max(0, end - start)
  if (span > 0) {
    return Array.from({ length: 7 }, (_, index) => new Date(start + (span * index) / 6))
  }
  return Array.from({ length: 13 }, (_, index) => new Date(start + (index - 6) * POINT_EVENT_WINDOW_HOURS * 3_600_000 / 6))
}

function anySample(event, predicate) {
  return samples(event).some(predicate)
}

function radiantAltitude(raHours, decDeg, date, lat, lon) {
  const observer = new Astronomy.Observer(lat, lon, 0)
  return Astronomy.Horizon(date, observer, raHours, decDeg, 'normal').altitude
}

function namedBody(target) {
  const name = target.charAt(0).toUpperCase() + target.slice(1)
  return name in Astronomy.Body ? Astronomy.Body[name] : null
}

function darkDuring(event, lat, lon) {
  return anySample(event, (date) => sunAltitude(date, lat, lon) < -6)
}

function localSolarVisible(event, lat, lon) {
  try {
    const start = new Date(event.startsAt).getTime()
    const end = new Date(event.endsAt || event.startsAt).getTime()
    const peak = new Date((start + end) / 2)
    const eclipse = Astronomy.SearchLocalSolarEclipse(new Date(peak.getTime() - 2 * 86400000), new Astronomy.Observer(lat, lon, 0))
    return Math.abs(eclipse.peak.time.date.getTime() - peak.getTime()) <= 3 * 86400000 && eclipse.peak.altitude > 0
  } catch {
    return true
  }
}

function conjunctionBodies(target) {
  return target.split('_').map((part) => namedBody(part)).filter(Boolean)
}

export function visibilityForEvent(event, lat, lon) {
  const kind = event.kind
  if (kind === 'eclipse' && event.target === 'sun') {
    return localSolarVisible(event, lat, lon)
      ? { visible: true, reason: 'solar-eclipse-above-horizon' }
      : { visible: false, reason: 'solar-eclipse-below-horizon' }
  }
  if (kind === 'eclipse' && event.target === 'moon') {
    const visible = anySample(event, (date) => position(Astronomy.Body.Moon, date, lat, lon) > 0)
    return { visible, reason: visible ? 'lunar-eclipse-on-night-side' : 'lunar-eclipse-daylight-or-below-horizon' }
  }
  if (kind === 'moon_phase') {
    const visible = event.target === 'new_moon' || anySample(event, (date) => position(Astronomy.Body.Moon, date, lat, lon) > 0)
    return { visible, reason: visible ? 'moon-above-horizon' : 'moon-below-horizon' }
  }
  if (kind === 'planet_event') {
    const body = namedBody(event.target)
    const visible = body ? anySample(event, (date) => position(body, date, lat, lon) > 5) : true
    return { visible, reason: visible ? 'target-above-horizon' : 'target-below-horizon' }
  }
  if (kind === 'conjunction') {
    const bodies = conjunctionBodies(event.target)
    const visible = bodies.length < 2 || anySample(event, (date) => bodies.every((body) => position(body, date, lat, lon) > 5))
    return { visible, reason: visible ? 'conjunction-above-horizon' : 'conjunction-below-horizon' }
  }
  if (kind === 'meteor_shower') {
    const radiant = METEOR_RADIANTS[event.target]
    const visible = Boolean(radiant) && anySample(event, (date) => sunAltitude(date, lat, lon) < -6 && radiantAltitude(radiant[0], radiant[1], date, lat, lon) > 15)
    return { visible, reason: visible ? 'darkness-and-radiant' : 'daylight-or-radiant-below-horizon' }
  }
  if (kind === 'aurora') {
    const threshold = Number(event.target.match(/lat(\d+)/)?.[1] ?? 90)
    const visible = Math.abs(lat) >= threshold && darkDuring(event, lat, lon)
    return { visible, reason: visible ? 'aurora-latitude-and-darkness' : 'aurora-too-far-equatorward-or-daylight' }
  }
  if (kind === 'iss_pass' || kind === 'satellite_flare') {
    const visible = darkDuring(event, lat, lon)
    return { visible, reason: visible ? 'satellite-pass-in-darkness' : 'satellite-pass-in-daylight' }
  }
  if (kind === 'deep_sky' || kind === 'night_sky_guide') {
    const visible = darkDuring(event, lat, lon)
    return { visible, reason: visible ? 'dark-sky-window' : 'daylight' }
  }
  return { visible: true, reason: 'no-local-gate' }
}

export function isVisibleFromLocation(event, lat, lon) {
  return visibilityForEvent(event, lat, lon).visible
}
