// Event-source plugin: computes new/full moon events via astronomy-engine's
// quarter-phase search (validated against JPL data), rather than hand-rolled
// synodic-month arithmetic. Contract: export an async fetchEvents({ now, windowDays })
// returning normalized records ready to upsert into the sky_events collection.
import * as Astronomy from 'astronomy-engine'

function toEvent(title, date) {
  const startsAt = date.toISOString()
  const isFullMoon = title === 'Full Moon'
  const isQuarterMoon = title === 'First Quarter' || title === 'Last Quarter'
  return {
    kind: 'moon_phase',
    target: 'moon',
    title,
    description: isFullMoon
      ? 'The Moon is fully illuminated and visible all night — best conditions for lunar observation and imaging.'
      : isQuarterMoon
        ? 'Half of the Moon is illuminated, making its shadowed crater edges especially striking through binoculars or a small telescope.'
        : 'The Moon is between Earth and the Sun and not visible — best conditions for viewing faint deep-sky objects.',
    content: isFullMoon
      ? 'A full moon rises at sunset and is visible all night. Great for lunar photography and naked-eye observation of maria and craters near the terminator in the days before/after peak fullness, though the bright sky washes out fainter deep-sky targets.'
      : isQuarterMoon
        ? 'A quarter moon is high in a dark sky for part of the night. Point binoculars or a small telescope along the day-night boundary (the terminator): long shadows make craters and mountain ranges much easier to see than at full moon.'
        : 'A new moon is not visible at all, since it rises and sets with the Sun. With no moonlight to wash out the sky, this is the best few nights of the month for viewing faint deep-sky objects like galaxies and nebulae.',
    starts_at: startsAt,
    // A phase peak is an instant, but lunar observing is not. Keeping the
    // full/quarter Moon active for several nights makes a 96%-illuminated
    // Moon discoverable after the exact astronomical peak has passed.
    ends_at: new Date(date.getTime() + (isFullMoon || isQuarterMoon ? 3 : 1) * 86_400_000).toISOString(),
    ...(isFullMoon
      ? { image_url: 'https://upload.wikimedia.org/wikipedia/commons/e/e1/FullMoon2010.jpg', image_credit: 'Gregory H. Revera, Wikimedia Commons' }
      // A new moon itself isn't visible, so its photo is of what a new-moon
      // dark sky enables instead: a proper naked-eye Milky Way.
      : { image_url: 'https://upload.wikimedia.org/wikipedia/commons/9/92/Milky_Way_Starry_sky_at_Nan%27ao.jpg', image_credit: 'Wikimedia Commons' }),
  }
}

// quarter: 0 = new moon, 1 = first quarter, 2 = full moon, 3 = third quarter.
// Quarter phases are excellent lunar observing opportunities, so all four
// phases belong in the curated feed.
const QUARTER_TITLE = { 0: 'New Moon', 1: 'First Quarter', 2: 'Full Moon', 3: 'Last Quarter' }

export async function fetchEvents({ now = new Date(), windowDays = 90 } = {}) {
  const end = now.getTime() + windowDays * 86_400_000
  const events = []

  // Look back far enough to retain the useful observing window after an
  // exact phase peak; SearchMoonQuarter otherwise only emits future peaks.
  let mq = Astronomy.SearchMoonQuarter(new Date(now.getTime() - 3 * 86_400_000))
  while (mq.time.date.getTime() <= end) {
    const title = QUARTER_TITLE[mq.quarter]
    const activeUntil = mq.time.date.getTime() + (title === 'Full Moon' || title === 'First Quarter' || title === 'Last Quarter' ? 3 : 1) * 86_400_000
    if (title && activeUntil >= now.getTime()) {
      events.push(toEvent(title, mq.time.date))
    }
    mq = Astronomy.NextMoonQuarter(mq)
  }

  return events
}
