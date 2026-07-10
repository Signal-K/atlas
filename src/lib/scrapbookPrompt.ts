import { getEventsInRange, pullSkyEvents } from './sync'
import type { SkyEvent } from './db'

// Prioritized roughly by how "worth writing about" an event kind tends to
// be -- a meteor shower or conjunction makes a better prompt than "the Moon
// is a waxing gibbous again", which happens most nights.
const KIND_PRIORITY = ['meteor_shower', 'eclipse', 'conjunction', 'iss_pass', 'planet_event', 'deep_sky', 'moon_phase']

function questionFor(event: SkyEvent): string {
  switch (event.kind) {
    case 'meteor_shower':
      return `How many ${event.title.replace(' Meteor Shower', '')} meteors did you spot tonight?`
    case 'eclipse':
      return `What did you notice during tonight's ${event.title.toLowerCase()}?`
    case 'conjunction':
      return `Did you catch tonight's ${event.title.toLowerCase()}? What did it look like?`
    case 'iss_pass':
      return `Did you catch the ISS pass tonight? What did it look like moving across the sky?`
    case 'planet_event':
      return `How did ${event.target} look tonight?`
    case 'deep_sky':
      return `Could you spot ${event.title.replace(' well placed for viewing', '')} tonight?`
    case 'moon_phase':
      return `How did the ${event.title.toLowerCase()} look tonight?`
    default:
      return 'What did you see in the sky tonight?'
  }
}

const FALLBACK_PROMPT = 'What did you see in the sky tonight?'

// Picks the single most notable event active roughly "tonight" (+/- 12h of
// now) to base a contextual Scrapbook prompt on, so the textarea asks a
// specific question instead of always showing the same generic placeholder.
export async function getScrapbookPrompt(now = new Date()): Promise<string> {
  // Best-effort refresh -- Scrapbook may be the first view visited this
  // session, so the local cache other widgets rely on can't be assumed warm.
  await pullSkyEvents()
  const rangeStart = new Date(now.getTime() - 12 * 3_600_000)
  const rangeEnd = new Date(now.getTime() + 12 * 3_600_000)
  const events = await getEventsInRange(rangeStart, rangeEnd)
  if (events.length === 0) return FALLBACK_PROMPT

  const sorted = [...events].sort((a, b) => {
    const rank = (event: SkyEvent) => {
      const index = KIND_PRIORITY.indexOf(event.kind)
      return index === -1 ? KIND_PRIORITY.length : index
    }
    return rank(a) - rank(b)
  })

  return questionFor(sorted[0])
}
