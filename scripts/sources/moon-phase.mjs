// Event-source plugin: computes new/full moon events algorithmically, no
// external API needed. Contract: export an async fetchEvents({ now, windowDays })
// returning normalized records ready to upsert into the sky_events collection.

const SYNODIC_MONTH_DAYS = 29.530588853
const SYNODIC_MONTH_MS = SYNODIC_MONTH_DAYS * 86_400_000
// A known new moon reference instant (2000-01-06 18:14 UTC).
const REFERENCE_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14)

function toEvent(title, timestampMs) {
  const startsAt = new Date(timestampMs).toISOString()
  return {
    kind: 'moon_phase',
    target: 'moon',
    title,
    description:
      title === 'New Moon'
        ? 'The Moon is between Earth and the Sun and not visible — best conditions for viewing faint deep-sky objects.'
        : 'The Moon is fully illuminated and visible all night — best conditions for lunar observation and imaging.',
    starts_at: startsAt,
    ends_at: startsAt,
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
