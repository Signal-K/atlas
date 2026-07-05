// Event-source plugin: known upcoming solar/lunar eclipses. These are
// published years in advance by astronomers (NASA eclipse catalogs etc.), so
// unlike moon phases/meteor showers this is a maintained static list rather
// than a computed one. Extend this list as more eclipses are confirmed.

const ECLIPSES = [
  {
    title: 'Total Solar Eclipse',
    target: 'sun',
    startsAtUtc: '2026-08-12T17:45:00Z',
    description: 'Totality crosses Greenland, Iceland, and Spain — one of the most anticipated eclipses of the decade.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/dd/2024_Total_Solar_Eclipse_Corona.jpg',
  },
  {
    title: 'Annular Solar Eclipse',
    target: 'sun',
    startsAtUtc: '2027-02-06T16:00:00Z',
    description: 'A "ring of fire" eclipse visible across parts of South America and Africa.',
  },
  {
    title: 'Total Solar Eclipse',
    target: 'sun',
    startsAtUtc: '2027-08-02T10:00:00Z',
    description: 'An exceptionally long totality (over 6 minutes) crossing Spain, North Africa, and the Middle East.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/dd/2024_Total_Solar_Eclipse_Corona.jpg',
  },
  {
    title: 'Total Lunar Eclipse',
    target: 'moon',
    startsAtUtc: '2028-01-12T04:00:00Z',
    description: 'The Moon passes fully through Earth’s shadow, turning a deep red — visible from the Americas and Europe.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/1f/VLT_Cerro_Paranal_Total_Lunar_Eclipse_21_December_2010.jpg',
  },
]

export async function fetchEvents({ now = new Date(), windowDays = 365 } = {}) {
  const start = now.getTime()
  const end = start + windowDays * 86_400_000

  return ECLIPSES.filter((eclipse) => {
    const ms = new Date(eclipse.startsAtUtc).getTime()
    return ms >= start && ms <= end
  }).map((eclipse) => {
    // Normalize to a millisecond-precision ISO string — PocketBase always
    // stores/returns dates with milliseconds, so a raw "...:00Z" input would
    // never match its own stored value on the next dedupe check.
    const startsAt = new Date(eclipse.startsAtUtc).toISOString()
    return {
      kind: 'eclipse',
      target: eclipse.target,
      title: eclipse.title,
      description: eclipse.description,
      content: `${eclipse.title} on ${new Date(eclipse.startsAtUtc).toDateString()}. ${eclipse.description}`,
      starts_at: startsAt,
      ends_at: startsAt,
      ...(eclipse.imageUrl ? { image_url: eclipse.imageUrl, image_credit: 'Wikimedia Commons' } : {}),
    }
  })
}
