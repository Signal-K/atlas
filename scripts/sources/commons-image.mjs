// Shared helper: search Wikimedia Commons for a real photo to guarantee an
// event has a cover image even when its source plugin has no fixed one
// (aurora, comets, and the text-guide sources all vary night to night/month
// to month, so there's no single hardcoded URL that stays right the way
// there is for eclipses/meteor showers/deep-sky objects).
//
// Same free, keyless, CORS-enabled Commons search API used by the frontend
// (see src/lib/eventImage.ts) so both the ingest-time and runtime fallback
// paths hit the same real source of images.
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php'

// Skip non-web-renderable formats (Commons happily returns .tiff/.svg/.pdf
// scans for "photo" queries -- an <img> tag won't render those usefully).
const USABLE_EXTENSION = /\.(jpe?g|png|webp|gif)$/i

const cache = new Map()

export async function searchCommonsImage(query, { credit = 'Wikimedia Commons' } = {}) {
  if (cache.has(query)) return cache.get(query)

  const result = await lookup(query, credit)
  cache.set(query, result)
  return result
}

async function lookup(query, credit) {
  try {
    const url = new URL(COMMONS_API)
    url.searchParams.set('action', 'query')
    url.searchParams.set('generator', 'search')
    url.searchParams.set('gsrsearch', query)
    url.searchParams.set('gsrnamespace', '6')
    url.searchParams.set('gsrlimit', '5')
    url.searchParams.set('prop', 'imageinfo')
    url.searchParams.set('iiprop', 'url')
    url.searchParams.set('iiurlwidth', '800')
    url.searchParams.set('format', 'json')

    const res = await fetch(url, { headers: { 'user-agent': 'Atlas event ingestion (+https://github.com/)' } })
    if (!res.ok) return null
    const data = await res.json()
    const pages = Object.values(data?.query?.pages ?? {})
    // Sort by Commons' own relevance order (the `index` field), then take
    // the first result that's actually a bitmap image.
    pages.sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    for (const page of pages) {
      const imageUrl = page?.imageinfo?.[0]?.url
      if (imageUrl && USABLE_EXTENSION.test(imageUrl)) {
        return { url: imageUrl, credit }
      }
    }
    return null
  } catch {
    return null
  }
}
