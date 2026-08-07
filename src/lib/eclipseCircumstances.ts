// Real per-observer eclipse circumstances (AT: eclipse detail depth), not
// just the global "somewhere on Earth" blurb from scripts/sources/eclipses.mjs.
// astronomy-engine's SearchLocalSolarEclipse computes what a specific lat/lon
// actually sees: partial vs. total/annular for them, % of the Sun obscured,
// and local start/peak/end times -- the same library the ingest pipeline
// already uses server-side, run here client-side for the viewer's location.
import * as Astronomy from 'astronomy-engine'

export interface LocalEclipseCircumstances {
  kind: 'total' | 'annular' | 'partial'
  obscurationPct: number
  visible: boolean
  partialBeginsAt: string | null
  totalBeginsAt: string | null
  peakAt: string
  totalEndsAt: string | null
  partialEndsAt: string | null
}

// How close the locally-found eclipse's peak must be to the event's known
// peak time to trust it's the same eclipse (SearchLocalSolarEclipse just
// returns the next one it finds for that observer, which could be a
// different eclipse entirely if searchStart is too far from the real event).
const MATCH_WINDOW_MS = 3 * 86_400_000

function eventTime(event: Astronomy.EclipseEvent): string | null {
  return event.altitude > 0 ? event.time.date.toISOString() : null
}

export function localSolarEclipseCircumstances(
  eventStartsAtIso: string,
  lat: number,
  lon: number,
): LocalEclipseCircumstances | null {
  try {
    const observer = new Astronomy.Observer(lat, lon, 0)
    const eventPeakMs = new Date(eventStartsAtIso).getTime()
    const searchStart = new Date(eventPeakMs - 2 * 86_400_000)
    const info = Astronomy.SearchLocalSolarEclipse(searchStart, observer)

    if (Math.abs(info.peak.time.date.getTime() - eventPeakMs) > MATCH_WINDOW_MS) return null

    return {
      kind: info.kind as 'total' | 'annular' | 'partial',
      obscurationPct: Math.round(info.obscuration * 100),
      visible: info.peak.altitude > 0,
      partialBeginsAt: eventTime(info.partial_begin),
      totalBeginsAt: info.total_begin ? eventTime(info.total_begin) : null,
      peakAt: info.peak.time.date.toISOString(),
      totalEndsAt: info.total_end ? eventTime(info.total_end) : null,
      partialEndsAt: eventTime(info.partial_end),
    }
  } catch {
    return null
  }
}
