// Event-source plugin: computes new/full moon events algorithmically, no
// external API needed. Contract: export an async fetchEvents({ now, windowDays })
// returning normalized records ready to upsert into the sky_events collection.

const SYNODIC_MONTH_DAYS = 29.530588853
const SYNODIC_MONTH_MS = SYNODIC_MONTH_DAYS * 86_400_000
// A known new moon reference instant (2000-01-06 18:14 UTC).
const REFERENCE_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14)

function toEvent(title, timestampMs) {
  const startsAt = new Date(timestampMs).toISOString()
  const isFullMoon = title === 'Full Moon'
  return {
    kind: 'moon_phase',
    target: 'moon',
    title,
    description: isFullMoon
      ? 'The Moon is fully illuminated and visible all night — best conditions for lunar observation and imaging.'
      : 'The Moon is between Earth and the Sun and not visible — best conditions for viewing faint deep-sky objects.',
    content: isFullMoon
      ? 'A full moon rises at sunset and is visible all night. Great for lunar photography and naked-eye observation of maria and craters near the terminator in the days before/after peak fullness, though the bright sky washes out fainter deep-sky targets.'
      : 'A new moon is not visible at all, since it rises and sets with the Sun. With no moonlight to wash out the sky, this is the best few nights of the month for viewing faint deep-sky objects like galaxies and nebulae.',
    starts_at: startsAt,
    ends_at: startsAt,
    ...(isFullMoon
      ? { image_url: 'https://upload.wikimedia.org/wikipedia/commons/e/e1/FullMoon2010.jpg', image_credit: 'Gregory H. Revera, Wikimedia Commons' }
      : {}),
  }
}

export async function fetchEvents({ now = new Date(), windowDays = 90 } = {}) {
  const start = now.getTime()
  const end = start + windowDays * 86_400_000
  const events = []

  let k = Math.floor((start - REFERENCE_NEW_MOON_MS) / SYNODIC_MONTH_MS) - 1
  for (;;) {
    const newMoonMs = REFERENCE_NEW_MOON_MS + k * SYNODIC_MONTH_MS
    if (newMoonMs > end) break

    const fullMoonMs = newMoonMs + SYNODIC_MONTH_MS / 2
    if (newMoonMs >= start && newMoonMs <= end) events.push(toEvent('New Moon', newMoonMs))
    if (fullMoonMs >= start && fullMoonMs <= end) events.push(toEvent('Full Moon', fullMoonMs))

    k += 1
  }

  return events
}
