export const METEOR_PEAK_OFFSET_MS: number

export function meteorPeakInstant(startsAtIso: string, target?: string): Date

export function zonedWallTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date

export function meteorBestViewingInstant(
  startsAtIso: string,
  timeZone?: string,
  coords?: { lat: number; lon: number } | null,
  target?: string,
): Date

export function eventDisplayInstant(
  event: { kind?: string; target?: string; startsAt: string },
  timeZone?: string,
  coords?: { lat: number; lon: number } | null,
): Date

export function timeZoneAbbreviation(iso: string, timeZone?: string): string

export function formatZonedDate(iso: string, timeZone?: string): string

export function formatZonedTime(iso: string | null | undefined, timeZone?: string, hour12?: boolean): string
