// The Daily Transit (thedailytransit.com) is a sibling Signal-K product
// (signal-k/saily monorepo) -- its published CMS articles are publicly
// readable straight off its production PocketBase REST API (same pattern
// its own Next.js frontend uses in web/src/lib/cms.ts: `status = "published"`
// is a public list/view rule on the `cms_articles` collection, CORS is
// open). This is real cross-product content, not anything generated inside
// Atlas -- there is no Atlas-side authoring or caching of it.
const DEFAULT_DAILY_TRANSIT_PB_URL = 'https://signal-k-saily.fly.dev'
const DAILY_TRANSIT_PB_URL = (import.meta.env.VITE_DAILY_TRANSIT_PB_URL as string | undefined) ?? DEFAULT_DAILY_TRANSIT_PB_URL
export const DAILY_TRANSIT_SITE_URL = 'https://thedailytransit.com'

export interface DailyTransitArticle {
  id: string
  slug: string
  title: string
  summary: string
  tags: string[] | null
  heroImage: string
  publishedAt: string
}

interface PocketBaseListResponse<T> {
  items: T[]
}

interface CmsArticleRecord {
  id: string
  slug: string
  title: string
  summary: string
  tags: string[] | null
  hero_image: string
  published_at: string
}

function toArticle(record: CmsArticleRecord): DailyTransitArticle {
  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    summary: record.summary,
    tags: record.tags,
    heroImage: record.hero_image,
    publishedAt: record.published_at,
  }
}

export function dailyTransitArticleUrl(slug: string): string {
  return `${DAILY_TRANSIT_SITE_URL}/articles/${slug}`
}

// Returns [] on any failure (offline, CORS, deploy down) rather than
// throwing -- this is a nice-to-have panel, not core Atlas functionality,
// and shouldn't break the events page if the sibling product is unreachable.
export async function fetchDailyTransitArticles(limit = 5): Promise<DailyTransitArticle[]> {
  const url = `${DAILY_TRANSIT_PB_URL}/api/collections/cms_articles/records?filter=${encodeURIComponent(
    'status = "published"',
  )}&sort=-published_at&perPage=${limit}`

  try {
    const response = await fetch(url)
    if (!response.ok) return []
    const data = (await response.json()) as PocketBaseListResponse<CmsArticleRecord>
    return data.items.map(toArticle)
  } catch {
    return []
  }
}
