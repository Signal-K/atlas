// Pure scoring function for "is tonight worth going outside" (AT epic 1).
// No React, no I/O -- callers gather conditions from weather.ts, moon
// illumination, and tonight's event list, then pass them in here.

export type TonightRating = 'great' | 'good' | 'maybe' | 'poor' | 'skip'

export interface TonightConditions {
  cloudCoverPct: number
  precipitationChancePct: number
  /** 0 = new moon, 100 = full moon. */
  moonIlluminationPct: number
  /**
   * True when tonight's target list includes something bright enough that
   * moon glare barely matters (ISS, Moon itself, planets) rather than only
   * faint deep-sky targets that moonlight washes out.
   */
  hasBrightTarget: boolean
}

export interface TonightScoreResult {
  rating: TonightRating
  reasons: string[]
}

const RATING_SCORE: Record<TonightRating, 1 | 2 | 3 | 4 | 5> = {
  skip: 1,
  poor: 2,
  maybe: 3,
  good: 4,
  great: 5,
}

const RATING_LABEL: Record<TonightRating, string> = {
  skip: 'Skip',
  poor: 'Poor',
  maybe: 'Maybe',
  good: 'Good',
  great: 'Great',
}

export function tonightRatingScore(rating: TonightRating): 1 | 2 | 3 | 4 | 5 {
  return RATING_SCORE[rating]
}

export function tonightRatingLabel(rating: TonightRating): string {
  return RATING_LABEL[rating]
}

function ratingForPoints(points: number): TonightRating {
  if (points >= 85) return 'great'
  if (points >= 65) return 'good'
  if (points >= 45) return 'maybe'
  if (points >= 25) return 'poor'
  return 'skip'
}

export function scoreTonight(conditions: TonightConditions): TonightScoreResult {
  const reasons: string[] = []

  // Cloud cover dominates: nothing is visible through solid overcast, so it
  // short-circuits straight to 'skip' rather than just losing points.
  if (conditions.cloudCoverPct >= 85) {
    return {
      rating: 'skip',
      reasons: [`Sky is expected to be almost fully clouded over (${Math.round(conditions.cloudCoverPct)}% cover)`],
    }
  }

  let points = 100

  if (conditions.cloudCoverPct >= 60) {
    points -= 40
    reasons.push(`Mostly cloudy tonight (${Math.round(conditions.cloudCoverPct)}% cover)`)
  } else if (conditions.cloudCoverPct >= 30) {
    points -= 15
    reasons.push(`Some cloud expected (${Math.round(conditions.cloudCoverPct)}% cover)`)
  } else {
    reasons.push(`Clear skies expected (${Math.round(conditions.cloudCoverPct)}% cloud cover)`)
  }

  if (conditions.precipitationChancePct >= 50) {
    points -= 30
    reasons.push(`High chance of rain (${Math.round(conditions.precipitationChancePct)}%)`)
  } else if (conditions.precipitationChancePct >= 20) {
    points -= 10
    reasons.push(`Some chance of rain (${Math.round(conditions.precipitationChancePct)}%)`)
  }

  if (!conditions.hasBrightTarget) {
    if (conditions.moonIlluminationPct >= 70) {
      points -= 20
      reasons.push('Bright moon will wash out faint targets')
    } else if (conditions.moonIlluminationPct <= 20) {
      reasons.push('Dark, moonless sky — good for faint targets')
    }
  }

  points = Math.max(0, Math.min(100, points))
  return { rating: ratingForPoints(points), reasons }
}
