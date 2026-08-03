// Brightest naked-eye stars up right now, for the Visible Tonight table's
// second section (STS: Atlas Tonight & Feed Redesign) -- real positions via
// astronomy-engine over the bundled Bright Star Catalogue subset, not a
// fixed mock list.
import { BRIGHT_STARS, type BrightStar } from '../data/brightStars'
import { getStarObjects } from './skyMapLayers'

export interface VisibleStarTonight {
  star: BrightStar
  altitudeDeg: number
  azimuthDeg: number
  compassLabel: string
  constellation?: string
}

const MAX_STARS = 8

export function getVisibleStarsTonight(date: Date, lat: number, lon: number): VisibleStarTonight[] {
  const objects = getStarObjects(date, lat, lon)
  return objects
    .filter((object) => object.visible)
    .sort((a, b) => (a.magnitude ?? 99) - (b.magnitude ?? 99))
    .slice(0, MAX_STARS)
    .map((object): VisibleStarTonight | null => {
      const star = BRIGHT_STARS.find((candidate) => candidate.id === object.id)
      if (!star) return null
      return {
        star,
        altitudeDeg: object.altitudeDeg,
        azimuthDeg: object.azimuthDeg,
        compassLabel: object.compassLabel,
        constellation: object.constellation,
      }
    })
    .filter((entry): entry is VisibleStarTonight => entry != null)
}
