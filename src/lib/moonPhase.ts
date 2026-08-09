import * as Astronomy from 'astronomy-engine'

export function moonIlluminationPctAt(date: Date): number {
  return Astronomy.Illumination(Astronomy.Body.Moon, date).phase_fraction * 100
}
