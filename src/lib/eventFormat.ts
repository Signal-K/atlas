import { localDateKey } from './weather'

// Shared date/countdown formatting for mobile event surfaces (Plan, Events).
export function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })
}

export function daysUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff < 60 * 60_000) return 'Soon'
  const days = Math.floor(diff / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `${days}d`
}

// Feed group header ("Today" / "Tomorrow" / date) -- calendar-day diff, not
// the rolling hour-based `daysUntil`, so an event at 11pm tonight and one at
// 1am tomorrow land in different groups even though `daysUntil` might both
// read "Today"/"Soon".
export function dateGroupLabel(iso: string, timeZone?: string): string {
  const dayNumber = (dateKey: string) => new Date(`${dateKey}T12:00:00Z`).getTime()
  const eventDateKey = localDateKey(iso, timeZone)
  const todayDateKey = localDateKey(new Date().toISOString(), timeZone)
  const days = Math.round((dayNumber(eventDateKey) - dayNumber(todayDateKey)) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  const includeYear = eventDateKey.slice(0, 4) !== todayDateKey.slice(0, 4)
  return new Date(iso)
    .toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', ...(includeYear ? { year: 'numeric' } : {}), timeZone })
    .toUpperCase()
}
