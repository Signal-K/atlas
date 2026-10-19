import type { OrionidsActivity } from './eventSources/meteor-showers.d.mts'

export const ORIONIDS_EVENT_ID: string
export const SPACETOBER_EVENT_ID: string
export const FIREBALL_EVENT_ID: string
export const ATLAS_SOURCE: string
export const SUBJECT_PHOTO: string
export const SUBJECT_CHECK_IN: string
export const SUBJECT_STAMP: string
export const SUBJECT_READING: string
export const AFTER_MOONSET_MARKER: string
export const ATLAS_ORIONIDS_PATH: string
export const ATLAS_ORIONIDS_URL: string
export const LANDNAM_ORIONIDS_URL: string
export const FIREBALLS_SOURCE_URL: string

export interface FireballQuestion {
  prompt: string
  choices: string[]
  correct: number
}

export const FIREBALL_QUIZ: FireballQuestion[]

export interface SpacetoberBadge {
  event_id: string
  subject_id: string
  tier: 'gold' | 'silver'
  source: string
  earned_at: number
  marker: string
  voucher: string
  grantsMastery: boolean
}

export function quizIsCorrect(selected: readonly number[]): boolean
export function orionidsPhase(date: Date, timeZone: string, activity?: OrionidsActivity): 'before' | 'during' | 'after'
export function orionidsLive(date: Date, timeZone: string, activity?: OrionidsActivity): boolean
export function spacetoberStripVisible(date: Date, timeZone: string, activity?: OrionidsActivity): boolean
export function awardsForObservation(input: {
  at: Date
  timeZone: string
  hasPhoto: boolean
  activity?: OrionidsActivity
}): SpacetoberBadge[]
export function fireballAward(input: {
  at: Date
  timeZone: string
  activity?: OrionidsActivity
  read: boolean
  quizCorrect: boolean
  watchMinutes: number
  meteorCount: number
}): SpacetoberBadge | null
export function badgeLabel(eventId: string, tier: 'gold' | 'silver'): string
export function raisesMeteoriteMastery(rows: readonly { grantsMastery?: boolean }[]): boolean
