export type SaturnTaskBadge = 'gold' | 'silver'
export interface SaturnTask {
  id: string
  title: string
  detail: string
  links: { label: string; url: string }[]
  period: { start: string; end: string; label: string }
  listed: boolean
}
export const SATURN_TASK_BADGE_GOLD: 'gold'
export const SATURN_TASK_BADGE_SILVER: 'silver'
export const SATURN_STORM_WATCH_FALLBACK: { title: string; detail: string }
export const SATURN_TASKS: SaturnTask[]
export function inPeriod(task: SaturnTask, now: Date): boolean
export function badgeFor(task: SaturnTask, now: Date): SaturnTaskBadge
export function visibleSaturnTasks(args: { hasTelescope: boolean; now?: Date; tasks?: SaturnTask[] }): {
  tasks: (SaturnTask & { badge: SaturnTaskBadge })[]
  fallback: { title: string; detail: string } | null
}
