import * as Astronomy from 'astronomy-engine'

export function moonIlluminationPctAt(date: Date): number {
  return Astronomy.Illumination(Astronomy.Body.Moon, date).phase_fraction * 100
}

// Astronomy.MoonPhase returns the moon's ecliptic longitude relative to the
// sun's, in degrees: 0 = new, 90 = first quarter, 180 = full, 270 = last
// quarter. Bucket it into the 8 named phases (each spans 45deg, centered on
// the 8 canonical angles) rather than just showing illumination %, which
// doesn't distinguish waxing from waning.
// Elongation runs 0 (new) -> 180 (full) -> 360 (new again), so the first half
// of the cycle is waxing. Illumination percentage alone can't tell the two
// apart -- 30% waxing and 30% waning look identical as a number but are lit on
// opposite limbs, which is what the phase graphic needs to know.
export function isMoonWaxingAt(date: Date): boolean {
  const angle = ((Astronomy.MoonPhase(date) % 360) + 360) % 360
  return angle < 180
}

export function moonPhaseNameAt(date: Date): string {
  const angle = ((Astronomy.MoonPhase(date) % 360) + 360) % 360
  const names = [
    'New moon',
    'Waxing crescent',
    'First quarter',
    'Waxing gibbous',
    'Full moon',
    'Waning gibbous',
    'Last quarter',
    'Waning crescent',
  ]
  const index = Math.round(angle / 45) % 8
  return names[index]
}
