// Revenue layer 1+2 from the Atlas monetization strategy: gear affiliate
// links on camera recipes, and tour/booking affiliate links on dark-sky
// trips. Both are env-configured and gated -- if no tag/base URL is set,
// the helpers return null and callers render nothing, so an unconfigured
// deployment never ships a dead or unattributed affiliate link.

const AMAZON_ASSOCIATE_TAG = import.meta.env.VITE_AMAZON_ASSOCIATE_TAG as string | undefined
const TOUR_AFFILIATE_BASE_URL = import.meta.env.VITE_TOUR_AFFILIATE_BASE_URL as string | undefined

// Amazon's Associates program supports plain search deep-links (no curated
// ASIN catalog needed): https://www.amazon.com/s?k=<query>&tag=<associate-tag>
export function gearAffiliateUrl(query: string): string | null {
  if (!AMAZON_ASSOCIATE_TAG) return null
  const params = new URLSearchParams({ k: query, tag: AMAZON_ASSOCIATE_TAG })
  return `https://www.amazon.com/s?${params.toString()}`
}

// Tour/booking affiliate base URL is a full URL template with a `{query}`
// placeholder, supplied via env once a real affiliate program (e.g. Viator,
// GetYourGuide) is set up -- the exact deep-link shape differs per program,
// so this stays a template rather than a hardcoded provider.
export function tourAffiliateUrl(siteName: string): string | null {
  if (!TOUR_AFFILIATE_BASE_URL) return null
  return TOUR_AFFILIATE_BASE_URL.replace('{query}', encodeURIComponent(siteName))
}
