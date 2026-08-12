// Event-source plugin: real computed eclipses via astronomy-engine (VSOP87-
// based ephemeris), not a hand-maintained list of guessed dates.
import * as Astronomy from 'astronomy-engine'

// Representative real photos (Wikimedia Commons), not tied to a specific
// instance since these are now computed dynamically rather than hardcoded.
const SOLAR_IMAGE = 'https://upload.wikimedia.org/wikipedia/commons/d/dd/2024_Total_Solar_Eclipse_Corona.jpg'
const LUNAR_IMAGE = 'https://upload.wikimedia.org/wikipedia/commons/1/1f/VLT_Cerro_Paranal_Total_Lunar_Eclipse_21_December_2010.jpg'

function solarKindLabel(kind) {
  if (kind === 'total') return 'Total Solar Eclipse'
  if (kind === 'annular') return 'Annular Solar Eclipse'
  if (kind === 'partial') return 'Partial Solar Eclipse'
  return 'Solar Eclipse'
}

function lunarKindLabel(kind) {
  if (kind === 'total') return 'Total Lunar Eclipse'
  if (kind === 'partial') return 'Partial Lunar Eclipse'
  return 'Penumbral Lunar Eclipse'
}

export async function fetchEvents({ now = new Date(), windowDays = 365 } = {}) {
  const start = now.getTime()
  const end = start + windowDays * 86_400_000
  const events = []

  let solar = Astronomy.SearchGlobalSolarEclipse(now)
  while (solar.peak.date.getTime() <= end) {
    if (solar.peak.date.getTime() >= start) {
      const title = solarKindLabel(solar.kind)
      // solar.peak.date is a single instant (maximum eclipse) -- using it
      // for both starts_at and ends_at makes a zero-duration event that
      // vanishes from every "still happening"/"upcoming" check the moment
      // that exact instant passes. Solar eclipses have real partial phases
      // lasting a couple of hours around maximum; pad generously so the
      // event stays "happening" through that window instead of blinking
      // out of existence.
      const startsAt = new Date(solar.peak.date.getTime() - 90 * 60_000).toISOString()
      const endsAt = new Date(solar.peak.date.getTime() + 90 * 60_000).toISOString()
      events.push({
        kind: 'eclipse',
        target: 'sun',
        title,
        description: `A ${solar.kind} solar eclipse, visible from parts of Earth's surface.`,
        content: `${title} on ${solar.peak.date.toDateString()}. Visibility is path-dependent — only a narrow track on Earth sees totality/annularity, with a wider region seeing a partial eclipse.`,
        starts_at: startsAt,
        ends_at: endsAt,
        image_url: SOLAR_IMAGE,
        image_credit: 'Wikimedia Commons',
      })
    }
    solar = Astronomy.NextGlobalSolarEclipse(solar.peak)
  }

  let lunar = Astronomy.SearchLunarEclipse(now)
  while (lunar.peak.date.getTime() <= end) {
    if (lunar.peak.date.getTime() >= start && lunar.kind !== 'penumbral') {
      // Penumbral eclipses are barely perceptible to the naked eye — skip
      // them to keep this feed useful rather than cluttered.
      const title = lunarKindLabel(lunar.kind)
      // Same zero-duration issue as the solar branch above -- lunar eclipse
      // phases run a couple of hours around maximum, so pad the window
      // instead of collapsing it to one instant.
      const startsAt = new Date(lunar.peak.date.getTime() - 90 * 60_000).toISOString()
      const endsAt = new Date(lunar.peak.date.getTime() + 90 * 60_000).toISOString()
      events.push({
        kind: 'eclipse',
        target: 'moon',
        title,
        description: `A ${lunar.kind} lunar eclipse, visible from the night side of Earth at the time.`,
        content: `${title} on ${lunar.peak.date.toDateString()}. Unlike solar eclipses, lunar eclipses are visible from the entire night hemisphere of Earth, no special path required.`,
        starts_at: startsAt,
        ends_at: endsAt,
        image_url: LUNAR_IMAGE,
        image_credit: 'Wikimedia Commons',
      })
    }
    lunar = Astronomy.NextLunarEclipse(lunar.peak)
  }

  return events
}
