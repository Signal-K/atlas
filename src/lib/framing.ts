// Equipment-aware framing (STS-177). Reuses tonight's-targets visibility
// logic (tonightTargets.ts getTonightPlan) as the base list and enriches it
// with a framing-match verdict per target -- it does not recompute
// visibility itself.
import type { GearProfile } from './cameraProfiles'
import type { TonightTarget } from './tonightTargets'

// Typical angular sizes in degrees. Deep-sky angular size varies far more
// than a phone lens' resolution can usefully distinguish, so this is a
// coarse per-kind/target lookup, not a precise ephemeris -- good enough to
// tell "this will be a speck" from "this won't fit in frame."
const ANGULAR_SIZE_DEG: Record<string, number> = {
  moon_phase: 0.52,
  iss_pass: 0.01, // a fast-moving point/streak, not a resolved disc
  planet_event: 0.01,
  conjunction: 0.05, // driven by separation between the two objects, not object size
  eclipse: 0.52, // lunar eclipses track the Moon's disc; solar eclipses need a filter regardless
}

// A few well-known deep-sky targets worth naming individually; anything
// else falls back to DEFAULT_DEEP_SKY_DEG.
const DEEP_SKY_ANGULAR_SIZE_DEG: Record<string, number> = {
  andromeda: 3.0,
  pleiades: 2.0,
  orion_nebula: 1.0,
  milky_way: 30, // effectively "fills a wide-field frame," not a discrete object
}

const DEFAULT_DEEP_SKY_DEG = 0.5

export function angularSizeDegForTarget(target: Pick<TonightTarget, 'kind' | 'title'>): number {
  if (target.kind === 'deep_sky') {
    const key = target.title.toLowerCase().replace(/[^a-z]+/g, '_')
    return DEEP_SKY_ANGULAR_SIZE_DEG[key] ?? DEFAULT_DEEP_SKY_DEG
  }
  return ANGULAR_SIZE_DEG[target.kind] ?? DEFAULT_DEEP_SKY_DEG
}

// Standard 35mm-equivalent field-of-view formula: 2 * atan(sensorWidth / (2 * focalLength)).
export function fieldOfViewDeg(gear: GearProfile): number {
  return (2 * Math.atan(gear.sensorWidthMm / (2 * gear.focalLengthMm)) * 180) / Math.PI
}

export type FramingMatch = 'good' | 'too-small' | 'too-large'

// A target under ~4% of the frame's width reads as an unresolved speck;
// over ~90% won't fit with any margin for composition.
const TOO_SMALL_RATIO = 0.04
const TOO_LARGE_RATIO = 0.9

export function framingMatch(targetAngularSizeDeg: number, fovDeg: number): FramingMatch {
  const ratio = targetAngularSizeDeg / fovDeg
  if (ratio < TOO_SMALL_RATIO) return 'too-small'
  if (ratio > TOO_LARGE_RATIO) return 'too-large'
  return 'good'
}

export interface FramedTarget extends TonightTarget {
  angularSizeDeg: number
  framingMatch: FramingMatch
}

export function enrichTargetsWithFraming(targets: TonightTarget[], gear: GearProfile): FramedTarget[] {
  const fovDeg = fieldOfViewDeg(gear)
  return targets
    .map((target) => {
      const angularSizeDeg = angularSizeDegForTarget(target)
      return { ...target, angularSizeDeg, framingMatch: framingMatch(angularSizeDeg, fovDeg) }
    })
    .sort((a, b) => Number(a.framingMatch !== 'good') - Number(b.framingMatch !== 'good'))
}
