// Extra visual content for high-profile events (eclipse/meteor shower detail
// view) beyond the single hero image already stored on the SkyEvent record.
// NASA's Image and Video Library is free, keyless, and CORS-enabled --
// https://images-api.nasa.gov/search -- so this runs client-side same as the
// existing Wikimedia Commons lookup (see commons-image.mjs / eventImage.ts),
// no backend/API-key plumbing required.
const NASA_IMAGES_API = 'https://images-api.nasa.gov/search'

export interface NasaImage {
  url: string
  title: string
  credit: string
}

const cache = new Map<string, NasaImage[]>()

interface NasaSearchItemData {
  title?: string
  center?: string
}

interface NasaSearchLink {
  rel: string
  href: string
}

interface NasaSearchItem {
  data?: NasaSearchItemData[]
  links?: NasaSearchLink[]
}

export async function searchNasaImages(query: string, limit = 4): Promise<NasaImage[]> {
  if (cache.has(query)) return cache.get(query)!

  const images = await lookup(query, limit)
  cache.set(query, images)
  return images
}

async function lookup(query: string, limit: number): Promise<NasaImage[]> {
  try {
    const url = new URL(NASA_IMAGES_API)
    url.searchParams.set('q', query)
    url.searchParams.set('media_type', 'image')

    const res = await fetch(url)
    if (!res.ok) return []
    const payload = await res.json()
    const items: NasaSearchItem[] = payload?.collection?.items ?? []

    const images: NasaImage[] = []
    for (const item of items) {
      if (images.length >= limit) break
      const preview = item.links?.find((link) => link.rel === 'preview')?.href
      if (!preview) continue
      const meta = item.data?.[0]
      images.push({
        url: preview,
        title: meta?.title ?? query,
        credit: meta?.center ? `NASA / ${meta.center}` : 'NASA',
      })
    }
    return images
  } catch {
    return []
  }
}
