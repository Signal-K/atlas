// Event-source plugin: comets. Unlike planets/moon/eclipses, astronomy-engine
// doesn't model arbitrary comet orbits, and which comets are actually bright
// enough to matter changes apparition to apparition -- there's no fixed
// catalog to compute against the way there is for conjunctions or meteor
// showers. So this follows the same pattern as earthsky-monthly-guide.mjs
// and melbourne-night-sky.mjs: a recurring pointer to a live, regularly
// updated source of current comet visibility, refreshed just by the ingest
// script re-running on its normal schedule, rather than a hand-maintained
// list of specific comet names/dates/magnitudes that would go stale (or
// simply be wrong) the moment a new comet is discovered or an expected one
// underperforms.
const COMET_TRACKER_URL = 'https://theskylive.com/comets'

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
      kind: 'comet',
      target: 'comet_watch',
      title: 'Comet watch this month',
      description: 'A live-updated list of the brightest comets currently visible, with magnitude estimates and finder charts.',
      content: `Comet visibility changes often and isn't practical to predict a year in advance the way eclipses or meteor showers are. Check a live comet tracker for what's actually bright right now before planning a trip out: ${COMET_TRACKER_URL}. Most comets need binoculars or a small scope -- only rare, exceptionally bright ones are naked-eye visible.`,
      starts_at: startsAt.toISOString(),
      ends_at: new Date(startsAt.getTime() + 3 * 3_600_000).toISOString(),
      image_url: '',
      image_credit: COMET_TRACKER_URL,
    },
  ]
}
