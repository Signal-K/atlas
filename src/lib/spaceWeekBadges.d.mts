export interface SpaceWeekBadgeDef {
  id: string
  label: string
  kind: 'badge' | 'stamp'
  date: string
  match: RegExp | null
}
export interface SpaceWeekBadgeState {
  id: string
  label: string
  kind: 'badge' | 'stamp'
  date: string
  tier: 'gold' | 'silver' | null
  earnedFrom: string | null
  link: string
}
export const SPACE_WEEK_YEAR: number
export const SPACE_WEEK_BADGES: SpaceWeekBadgeDef[]
export function spaceWeekBadgeLink(id: string): string
export function evaluateSpaceWeekBadges(observations: readonly {
  id: string
  observedAt: string
  targetName?: string
  eventId?: string
  note?: string
  checkInKind?: string
  communityNightHost?: string
  reviewStatus?: string
}[]): SpaceWeekBadgeState[]
