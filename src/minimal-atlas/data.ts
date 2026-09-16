export type EventRecord = {
  id: string
  title: string
  cat: string
  catId: string
  icon: string
  day: number
  time: string
  alt: string
  look: string
  cloud: string
  blurb: string
}

export const EVENTS: EventRecord[] = [
  { id: 'iss-16', title: 'ISS pass, mag −3.1', cat: 'Satellites', catId: 'satellites', icon: 'satellite', day: 0, time: '20:14', alt: '68°', look: 'SW', cloud: '22%', blurb: 'Crosses south-west to north-east, four minutes above 20°.' },
  { id: 'moon-16', title: 'Waxing crescent, 34% lit', cat: 'Moon & eclipses', catId: 'moon', icon: 'moon', day: 0, time: '21:02', alt: '19°', look: 'W', cloud: '22%', blurb: 'Sets at 23:48, which is when the dark window really opens.' },
  { id: 'sat-16', title: 'Saturn close to the Moon', cat: 'Planets & conjunctions', catId: 'planets', icon: 'orbit', day: 0, time: '22:30', alt: '31°', look: 'SSE', cloud: '25%', blurb: 'Under three degrees apart — both fit in one binocular field.' },
  { id: 'starlink-17', title: 'Starlink train, 22 sats', cat: 'Satellites', catId: 'satellites', icon: 'satellite', day: 1, time: '20:48', alt: '54°', look: 'W', cloud: '40%', blurb: 'Recent launch, still bunched into a visible string.' },
  { id: 'm31-17', title: 'M31 Andromeda high overhead', cat: 'Deep sky', catId: 'deep-sky', icon: 'telescope', day: 1, time: '23:40', alt: '74°', look: 'NE', cloud: '35%', blurb: 'Best altitude of the month. Naked eye from a dark site.' },
  { id: 'jup-18', title: 'Jupiter rises before dawn', cat: 'Planets & conjunctions', catId: 'planets', icon: 'orbit', day: 2, time: '03:20', alt: '22°', look: 'E', cloud: '55%', blurb: 'Four Galilean moons resolvable in steady binoculars.' },
  { id: 'aurora-18', title: 'Aurora watch, Kp 5 forecast', cat: 'Aurora & space weather', catId: 'aurora', icon: 'aurora', day: 2, time: '22:00', alt: '—', look: 'N', cloud: '55%', blurb: 'Coronal hole stream arriving. Northern horizon, low odds this far south.' },
  { id: 'perseus-19', title: 'Double Cluster in Perseus', cat: 'Deep sky', catId: 'deep-sky', icon: 'telescope', day: 3, time: '00:10', alt: '61°', look: 'NE', cloud: '18%', blurb: 'Two open clusters in one field. The easiest deep-sky win there is.' },
  { id: 'moon-19', title: 'First quarter Moon', cat: 'Moon & eclipses', catId: 'moon', icon: 'moon', day: 3, time: '21:15', alt: '27°', look: 'SW', cloud: '18%', blurb: 'Terminator craters at their sharpest along the straight edge.' },
  { id: 'nep-20', title: 'Neptune at opposition', cat: 'Planets & conjunctions', catId: 'planets', icon: 'orbit', day: 4, time: '01:00', alt: '34°', look: 'S', cloud: '30%', blurb: 'Closest approach of the year. A blue-grey disc at high magnification.' },
  { id: 'comet-20', title: 'Comet tracker', cat: 'Guides', catId: 'guides', icon: 'book', day: 4, time: '—', alt: '—', look: '—', cloud: '30%', blurb: 'Reference card, not a dated event. Current brightness estimates for anything above mag 10.' },
  { id: 'harvest-24', title: 'Harvest Moon rises', cat: 'Moon & eclipses', catId: 'moon', icon: 'moon', day: 8, time: '19:50', alt: '8°', look: 'ESE', cloud: '45%', blurb: 'Full Moon at moonrise, large and orange against the horizon.' },
  { id: 'drac-06', title: 'Draconids begin', cat: 'Meteors & fireballs', catId: 'meteors', icon: 'zap', day: 20, time: '22:30', alt: '—', look: 'NNW', cloud: '—', blurb: 'Slow, bright meteors from Draco. Peaks in three nights.' },
]

export const NAV = [
  { key: 'focus', label: 'Upcoming' },
  { key: 'events', label: 'All events' },
  { key: 'journal', label: 'Journal' },
  { key: 'you', label: 'You' },
] as const

export const CATS = [
  { id: 'moon', label: 'Moon & eclipses', hue: 'oklch(.62 .13 70)' },
  { id: 'planets', label: 'Planets & conjunctions', hue: 'oklch(.62 .13 288)' },
  { id: 'meteors', label: 'Meteors & fireballs', hue: 'oklch(.62 .13 15)' },
  { id: 'satellites', label: 'Satellites', hue: 'oklch(.62 .13 200)' },
  { id: 'aurora', label: 'Aurora & space weather', hue: 'oklch(.62 .13 145)' },
  { id: 'deep-sky', label: 'Deep sky', hue: 'oklch(.55 .13 288)' },
  { id: 'guides', label: 'Guides', hue: 'oklch(.62 .05 288)' },
]

export const JOURNAL = [
  { id: 'j1', date: '14 SEP', result: 'Photographed', tone: 'green' as const, title: 'Milky Way core over Kielder', note: '20s at f/1.8, ISO 3200. First frame where the dust lanes actually showed.', thumb: 'PHOTO' },
  { id: 'j2', date: '11 SEP', result: 'Clouded out', tone: 'neutral' as const, title: 'Waited out the Perseid tail', note: 'Two hours, eight breaks in the cloud, nothing through any of them.', thumb: 'NO IMG' },
  { id: 'j3', date: '07 SEP', result: 'Saw it', tone: 'violet' as const, title: 'ISS, west to east', note: 'Brighter than Jupiter. Caught it from the back step without looking anything up.', thumb: 'PHOTO' },
  { id: 'j4', date: '02 SEP', result: 'Partial', tone: 'amber' as const, title: 'Saturn through the 8-inch', note: 'Rings resolved, Cassini division came and went with the seeing.', thumb: 'PHOTO' },
]

export const CITIES = [
  { name: 'London', meta: 'Bortle 8 · BST · current' },
  { name: 'Kielder Forest', meta: 'Bortle 2 · dark sky park' },
  { name: 'Brecon Beacons', meta: 'Bortle 3 · dark sky reserve' },
  { name: 'Edinburgh', meta: 'Bortle 7' },
  { name: 'Tromsø', meta: 'Bortle 4 · aurora zone' },
  { name: 'La Palma', meta: 'Bortle 2 · WET' },
]

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const BASE = new Date(2026, 8, 16)

export function dayInfo(offset: number) {
  const d = new Date(BASE.getTime() + offset * 86400000)
  const label = offset === 0 ? 'Tonight' : offset === 1 ? 'Tomorrow' : DAY_NAMES[d.getDay()]
  return {
    label,
    date: `${String(d.getDate()).padStart(2, '0')} ${MONTH_NAMES[d.getMonth()]}`,
    dayOfMonth: d.getDate(),
    month: d.getMonth(),
  }
}

export function makeRng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

export const PALETTE = ['oklch(.72 .14 288)', 'oklch(.72 .14 200)', 'oklch(.76 .14 70)', 'oklch(.70 .14 15)', 'oklch(.74 .13 145)']

export const WASH_SPECS = [
  { left: '-14%', top: '6%', size: 260, hue: 288 },
  { left: '58%', top: '38%', size: 300, hue: 200 },
  { left: '4%', top: '74%', size: 240, hue: 25 },
]
