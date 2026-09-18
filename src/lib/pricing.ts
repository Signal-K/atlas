// One source of truth for what Sky Pass costs.
//
// The paywall used to hardcode "Get Sky Pass · £24 once" in its button label
// while the landing page sold CHF 4 / 40 / 55. A visitor saw Swiss francs on
// the way in and pounds sterling at the moment of purchase, for an amount that
// matched none of the configured Polar products. Both surfaces now read these
// constants, so a price change lands in one place or not at all.
//
// These mirror the Polar products in POLAR_PRODUCT_IDS (see .env.example).
// Polar owns the authoritative amount at checkout -- this is display copy, and
// deliberately stays coarse enough that it cannot contradict the real charge
// the way a precise foreign-currency figure did.

export const SKY_PASS_CURRENCY = 'CHF'

export interface SkyPassTier {
  id: 'monthly' | 'yearly' | 'lifetime'
  label: string
  price: string
}

export const SKY_PASS_TIERS: SkyPassTier[] = [
  { id: 'monthly', label: 'Monthly', price: 'CHF 4/mo' },
  { id: 'yearly', label: 'Yearly', price: 'CHF 40/yr' },
  { id: 'lifetime', label: 'Lifetime (founding member)', price: 'CHF 55 once' },
]

// The cheapest way in, for one-line summaries ("from CHF 4 a month").
export const SKY_PASS_ENTRY_PRICE = 'CHF 4'

// Used wherever a single figure has to stand in for the whole range.
export const SKY_PASS_SUMMARY = 'From CHF 4 a month, or CHF 55 once for life.'
