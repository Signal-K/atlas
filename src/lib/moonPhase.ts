import * as Astronomy from 'astronomy-engine'

export function moonIlluminationPctAt(date: Date): number {
  return Astronomy.Illumination(Astronomy.Body.Moon, date).phase_fraction * 100
}

// Astronomy.MoonPhase returns the moon's ecliptic longitude relative to the
// sun's, in degrees: 0 = new, 90 = first quarter, 180 = full, 270 = last
// quarter. Bucket it into the 8 named phases (each spans 45deg, centered on
// the 8 canonical angles) rather than just showing illumination %, which
// doesn't distinguish waxing from waning.
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
