// Curated star-cluster picks for the Calendar view's "tonight's cluster"
// card. Deliberately computed client-side with astronomy-engine (already a
// dependency, see darknessWindow.ts) against the observer's real
// coordinates and the night's optimal viewing time, rather than a static
// "best time of year" table like scripts/sources/deep-sky-objects.mjs --
// that's the difference between "this is up there somewhere this year" and
// "this is above your horizon tonight."
import * as Astronomy from 'astronomy-engine'

export type ClusterKind = 'open' | 'globular'

export interface ClusterTarget {
  id: string
  name: string
  kind: ClusterKind
  /** J2000 right ascension, decimal hours. */
  ra: number
  /** J2000 declination, decimal degrees. */
  dec: number
  magnitude: number
  constellation: string
  description: string
  photographyNote: string
  imageUrl: string
  imageCredit: string
}

// Bright, compact, high-contrast clusters that reward a phone camera on a
// tripod or a short telephoto exposure -- not just "visible," but the ones
// people actually post photos of. RA/Dec are standard J2000 catalog
// positions (same source convention as deep-sky-objects.mjs).
export const CLUSTER_TARGETS: ClusterTarget[] = [
  {
    id: 'm45',
    name: 'Pleiades (M45)',
    kind: 'open',
    ra: 3.79,
    dec: 24.12,
    magnitude: 1.6,
    constellation: 'Taurus',
    description: 'The Seven Sisters -- a tight, brilliant knot of hot young stars, naked-eye visible even from light-polluted skies.',
    photographyNote: 'A wide-field or telephoto shot picks up the faint blue reflection nebulosity around the brightest stars.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Pleiades_large.jpg',
    imageCredit: 'NASA/ESA, Wikimedia Commons',
  },
  {
    id: 'm44',
    name: 'Beehive Cluster (M44)',
    kind: 'open',
    ra: 8.67,
    dec: 19.98,
    magnitude: 3.7,
    constellation: 'Cancer',
    description: 'A large, loose swarm of stars easily mistaken for a faint smudge to the naked eye -- binoculars resolve dozens of individual stars.',
    photographyNote: 'Its wide apparent size (bigger than the full Moon) suits a standard lens more than a telescope.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/9b/Beehive_Cluster.jpg',
    imageCredit: 'Wikimedia Commons',
  },
  {
    id: 'double-cluster',
    name: 'Double Cluster (NGC 869/884)',
    kind: 'open',
    ra: 2.33,
    dec: 57.14,
    magnitude: 4.3,
    constellation: 'Perseus',
    description: 'Two dense open clusters sitting side by side, close enough together to frame in the same eyepiece or photo.',
    photographyNote: 'Circumpolar from mid-northern latitudes, so it is well placed for most of the night -- a forgiving target for a first attempt.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/85/Perseus_Double_Cluster_2.jpg',
    imageCredit: 'Wikimedia Commons',
  },
  {
    id: 'm13',
    name: 'Hercules Cluster (M13)',
    kind: 'globular',
    ra: 16.7,
    dec: 36.46,
    magnitude: 5.8,
    constellation: 'Hercules',
    description: 'One of the brightest globular clusters visible from the northern hemisphere -- hundreds of thousands of stars packed into a tight ball.',
    photographyNote: 'Needs a telescope to resolve into individual stars; a short exposure through one shows a dense, sparkling core.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e1/The_Great_Globular_Cluster_in_Hercules_Messier_13_%28M13%29.jpg',
    imageCredit: 'Wikimedia Commons',
  },
  {
    id: 'm6',
    name: 'Butterfly Cluster (M6)',
    kind: 'open',
    ra: 17.67,
    dec: -32.22,
    magnitude: 4.2,
    constellation: 'Scorpius',
    description: 'A bright open cluster whose brightest stars trace a butterfly-wing outline -- a striking naked-eye target from a dark southern sky.',
    photographyNote: 'Sits low for northern observers but rides high for southern-hemisphere ones -- worth checking regardless of your latitude.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/94/Open_Cluster_Messier_6.jpg',
    imageCredit: 'Wikimedia Commons',
  },
  {
    id: 'm7',
    name: 'Ptolemy Cluster (M7)',
    kind: 'open',
    ra: 17.897,
    dec: -34.79,
    magnitude: 3.3,
    constellation: 'Scorpius',
    description: 'One of the brightest open clusters in the sky, known since antiquity -- easily visible to the naked eye near the tail of Scorpius.',
    photographyNote: 'Large and loose, so it photographs well with nothing more than a camera and a wide lens on a tripod.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/09/Ptolemy%27s_Cluster.jpg',
    imageCredit: 'Wikimedia Commons',
  },
  {
    id: 'jewel-box',
    name: 'Jewel Box (NGC 4755)',
    kind: 'open',
    ra: 12.88,
    dec: -60.35,
    magnitude: 4.2,
    constellation: 'Crux',
    description: 'A small, colourful cluster next to the Southern Cross, prized for the contrast between its blue-white stars and one striking red supergiant.',
    photographyNote: 'Compact enough to need a telephoto lens or telescope to make the colour contrast pop.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/82/Jewel_Box_Cluster.jpg',
    imageCredit: 'ESO, Wikimedia Commons',
  },
  {
    id: 'omega-centauri',
    name: 'Omega Centauri',
    kind: 'globular',
    ra: 13.44,
    dec: -47.48,
    magnitude: 3.9,
    constellation: 'Centaurus',
    description: 'The largest and brightest globular cluster in the sky -- some ten million stars, visible to the naked eye as a fuzzy "star."',
    photographyNote: 'Bright enough for a short exposure with almost any camera setup to start resolving its outer stars.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/7f/Omega_Centauri_by_ESO.jpg',
    imageCredit: 'ESO, Wikimedia Commons',
  },
  {
    id: '47-tucanae',
    name: '47 Tucanae',
    kind: 'globular',
    ra: 0.4,
    dec: -72.08,
    magnitude: 4.1,
    constellation: 'Tucana',
    description: 'The second-brightest globular cluster in the sky, a dense southern-sky companion to the Small Magellanic Cloud.',
    photographyNote: 'Its blazing, condensed core makes it one of the most rewarding globulars to image from a southern latitude.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e4/A_Swarm_of_Ancient_Stars_-_GPN-2000-000930.jpg',
    imageCredit: 'NASA, Wikimedia Commons',
  },
  {
    id: 'coathanger',
    name: "Coathanger (Brocchi's Cluster)",
    kind: 'open',
    ra: 19.58,
    dec: 20.28,
    magnitude: 3.6,
    constellation: 'Vulpecula',
    description: 'An unmistakable asterism of ten stars forming a coat hanger shape, a favourite easy binocular target along the summer Milky Way.',
    photographyNote: 'Best framed wide -- its distinctive shape is the whole appeal, so keep the surrounding star field in the shot.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/17/Collinder_399.jpg',
    imageCredit: 'Wikimedia Commons',
  },
]

export interface TonightCluster extends ClusterTarget {
  altitudeDeg: number
  azimuthDeg: number
}

const MIN_ALTITUDE_DEG = 25

function altitudeAt(target: ClusterTarget, date: Date, observer: Astronomy.Observer) {
  return Astronomy.Horizon(date, observer, target.ra, target.dec, 'normal')
}

// Deterministic per-day tie-break so the pick doesn't jump around on every
// re-render, but does vary day to day among otherwise-equal candidates.
function dailySeed(dateKey: string): number {
  let hash = 0
  for (let i = 0; i < dateKey.length; i += 1) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) >>> 0
  }
  return hash
}

// Picks the best-placed cluster for the given night that the caller hasn't
// already logged an observation of (see observations.ts), preferring the
// highest altitude among unseen candidates and falling back to the
// highest-altitude seen one only once every candidate has been checked off.
export function pickTonightCluster(lat: number, lon: number, at: Date, alreadyObservedNames: Set<string>): TonightCluster | null {
  const observer = new Astronomy.Observer(lat, lon, 0)
  const visible = CLUSTER_TARGETS.map((target) => {
    const horizon = altitudeAt(target, at, observer)
    return { target, altitudeDeg: horizon.altitude, azimuthDeg: horizon.azimuth }
  }).filter((candidate) => candidate.altitudeDeg >= MIN_ALTITUDE_DEG)

  if (visible.length === 0) return null

  const isUnseen = (name: string) => !alreadyObservedNames.has(name.toLowerCase())
  const unseen = visible.filter((candidate) => isUnseen(candidate.target.name))
  const pool = unseen.length > 0 ? unseen : visible

  const dateKey = at.toISOString().slice(0, 10)
  const seed = dailySeed(dateKey)
  const sorted = [...pool].sort((a, b) => b.altitudeDeg - a.altitudeDeg)
  // Rotate through the top few well-placed candidates by day rather than
  // always surfacing the single highest one -- keeps repeat visits varied.
  const shortlist = sorted.slice(0, Math.min(3, sorted.length))
  const choice = shortlist[seed % shortlist.length]

  return { ...choice.target, altitudeDeg: choice.altitudeDeg, azimuthDeg: choice.azimuthDeg }
}
