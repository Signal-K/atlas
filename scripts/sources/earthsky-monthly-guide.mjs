const EARTHSKY_URL = 'https://earthsky.org/astronomy-essentials/visible-planets-tonight-mars-jupiter-venus-saturn-mercury/'

function nextEvening(now) {
  const date = new Date(now)
  date.setHours(19, 0, 0, 0)
  if (date.getTime() < now.getTime()) date.setDate(date.getDate() + 1)
  return date
}

export async function fetchEvents({ now = new Date() } = {}) {
  const startsAt = nextEvening(now)
  return [
    {
      kind: 'night_sky_guide',
      target: 'visible_planets',
      title: 'Visible planets this month',
      description: 'EarthSky maintains a monthly guide to naked-eye planet visibility, including Mercury, Venus, Mars, Jupiter, and Saturn.',
      content: `Use EarthSky's monthly visible-planets guide to cross-check tonight's planet targets before observing: ${EARTHSKY_URL}`,
      starts_at: startsAt.toISOString(),
      ends_at: new Date(startsAt.getTime() + 3 * 3_600_000).toISOString(),
      image_url: '',
      image_credit: EARTHSKY_URL,
    },
  ]
}
