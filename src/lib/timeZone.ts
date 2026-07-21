interface ZonedParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function partsAt(date: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]))
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  }
}

function offsetAt(date: Date, timeZone: string): number {
  const parts = partsAt(date, timeZone)
  const representedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return representedAsUtc - Math.floor(date.getTime() / 1000) * 1000
}

function zonedWallTimeToUtc(wallTimeMs: number, timeZone: string): Date {
  let candidate = new Date(wallTimeMs)
  candidate = new Date(wallTimeMs - offsetAt(candidate, timeZone))
  return new Date(wallTimeMs - offsetAt(candidate, timeZone))
}

export function tonightWindowForTimeZone(now: Date, timeZone?: string): { start: Date; end: Date } {
  if (!timeZone) {
    const end = new Date(now)
    if (end.getHours() >= 6) end.setDate(end.getDate() + 1)
    end.setHours(6, 0, 0, 0)
    return { start: now, end }
  }

  try {
    const local = partsAt(now, timeZone)
    const dayOffset = local.hour < 6 ? 0 : 1
    const wallEnd = Date.UTC(local.year, local.month - 1, local.day + dayOffset, 6, 0, 0)
    return { start: now, end: zonedWallTimeToUtc(wallEnd, timeZone) }
  } catch {
    return tonightWindowForTimeZone(now)
  }
}
