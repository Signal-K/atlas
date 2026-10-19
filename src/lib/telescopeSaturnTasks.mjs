// ASV-128. Telescope citizen-science tasks for Saturn and Jupiter. Atlas does
// not host any of the data: every task links to the archive the observation
// belongs in. Pure data + selection so it runs under node:test.

export const SATURN_TASK_BADGE_GOLD = 'gold'
export const SATURN_TASK_BADGE_SILVER = 'silver'

// Shown instead of the task list to people without a telescope (SSC-43).
export const SATURN_STORM_WATCH_FALLBACK = {
  title: 'Saturn Storm Watch',
  detail: 'No telescope? Help search for Saturn thunderstorms in the shared science pool instead.',
}

const DAY_MS = 86_400_000
const at = (iso) => Date.parse(`${iso}T00:00:00Z`)

// `period` is the event window in which the task earns the gold badge; any other
// time it earns silver. `listed` gates a task until the organiser has published
// the event (flip to true when IOTA-ES lists it).
export const SATURN_TASKS = [
  {
    id: 'saturn-rings-pvol',
    title: 'Image Saturn’s disc or ring spokes',
    detail: 'Capture Saturn through your telescope and upload the frames so professionals and amateurs can track the planet.',
    links: [
      { label: 'PVOL', url: 'http://pvol2.ehu.eus/pvol2/' },
      { label: 'ALPO', url: 'https://alpo-astronomy.org/' },
      { label: 'BAA', url: 'https://britastro.org/' },
    ],
    // Saturn opposition is 4 Oct 2026.
    period: { start: '2026-09-20', end: '2026-11-04', label: 'Saturn opposition' },
    listed: true,
  },
  {
    id: 'detect-video',
    title: 'Run DeTeCt on your Saturn or Jupiter video',
    detail: 'Scan your own planetary video for impact flashes with the DeTeCt software, then submit the result.',
    links: [{ label: 'DeTeCt', url: 'http://www.astrosurf.com/planetessaf/doc/project_detect.php' }],
    period: { start: '2026-09-20', end: '2026-11-04', label: 'Saturn opposition' },
    listed: true,
  },
  {
    id: 'jupiter-mutual-events',
    title: 'Record Jupiter mutual events',
    detail: 'Time the moons eclipsing and occulting one another while Jupiter’s mutual-event season runs.',
    links: [{ label: 'PVOL', url: 'http://pvol2.ehu.eus/pvol2/' }],
    period: { start: '2026-10-06', end: '2027-08-31', label: 'Jupiter mutual events' },
    listed: true,
  },
  {
    id: 'iapetus-occultation-2027',
    title: 'Iapetus occultation, 17 Sep 2027',
    detail: 'Saturn’s moon Iapetus passes in front of a star; Tallinn is in the path. Report your timing to IOTA-ES.',
    links: [{ label: 'IOTA-ES', url: 'https://www.iota-es.de/' }],
    period: { start: '2027-09-16', end: '2027-09-18', label: 'Iapetus occultation' },
    listed: false,
  },
  {
    id: 'phoebe-occultation-2027',
    title: 'Phoebe occultation, 6 Nov 2027',
    detail: 'Saturn’s moon Phoebe passes in front of a star, visible from southern Europe. Report your timing to IOTA-ES.',
    links: [{ label: 'IOTA-ES', url: 'https://www.iota-es.de/' }],
    period: { start: '2027-11-05', end: '2027-11-07', label: 'Phoebe occultation' },
    listed: false,
  },
]

export function inPeriod(task, now) {
  const t = now.getTime()
  return t >= at(task.period.start) && t < at(task.period.end) + DAY_MS
}

export function badgeFor(task, now) {
  return inPeriod(task, now) ? SATURN_TASK_BADGE_GOLD : SATURN_TASK_BADGE_SILVER
}

// Tasks to show now: hidden once the event is over, and hidden until listed.
export function visibleSaturnTasks({ hasTelescope, now = new Date(), tasks = SATURN_TASKS }) {
  if (!hasTelescope) return { tasks: [], fallback: SATURN_STORM_WATCH_FALLBACK }
  const visible = tasks
    .filter((task) => task.listed && now.getTime() < at(task.period.end) + DAY_MS)
    .map((task) => ({ ...task, badge: badgeFor(task, now) }))
  return { tasks: visible, fallback: null }
}
