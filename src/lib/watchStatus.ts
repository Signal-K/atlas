// Per-watched-target live status for the mobile Watch tab: "is this visible
// right now, and if not, when does that change" -- distinct from
// tonightTargets.ts's whole-night ranked plan, this is a status for one
// specific watchlist entry, at any time of day.
import * as Astronomy from 'astronomy-engine'
import { db, type SkyEvent } from './db'
import { bodyForTarget } from './skyPosition'
import type { WatchlistItem } from './watchlist'

export type WatchStatusKind = 'visible' | 'pending' | 'below-horizon'

export interface WatchStatus {
  status: WatchStatusKind
  statusLabel: string
  timeLabel: string
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

async function matchingEvents(item: WatchlistItem): Promise<SkyEvent[]> {
  const all = await db.skyEvents.toArray()
  return item.kind === 'event_type'
    ? all.filter((event) => event.kind === item.value)
    : all.filter((event) => event.target.toLowerCase() === item.value.toLowerCase())
}

function fromNextEvent(events: SkyEvent[], now: Date): WatchStatus {
  const upcoming = events.filter((event) => event.startsAt >= now.toISOString()).sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  const ongoing = events.find((event) => event.startsAt <= now.toISOString() && event.endsAt >= now.toISOString())

  if (ongoing) {
    return { status: 'visible', statusLabel: 'Visible', timeLabel: `Until ${formatTime(new Date(ongoing.endsAt))}` }
  }
  if (upcoming.length > 0) {
    return { status: 'pending', statusLabel: 'Pending', timeLabel: formatTime(new Date(upcoming[0].startsAt)) }
  }
  return { status: 'below-horizon', statusLabel: 'No data', timeLabel: '—' }
}

// Tries a real rise/set/altitude computation for bodies astronomy-engine can
// resolve (Moon, planets); falls back to the next matching cached SkyEvent's
// timing for everything else (ISS passes, deep-sky objects, meteor showers).
export async function getWatchTargetStatus(item: WatchlistItem, lat: number, lon: number, now = new Date()): Promise<WatchStatus> {
  const events = await matchingEvents(item)

  if (item.kind === 'target') {
    const kindGuess = events[0]?.kind
    const body = kindGuess ? bodyForTarget(kindGuess, item.value) : null
    if (body) {
      const observer = new Astronomy.Observer(lat, lon, 0)
      const equator = Astronomy.Equator(body, now, observer, true, true)
      const horizontal = Astronomy.Horizon(now, observer, equator.ra, equator.dec, 'normal')

      if (horizontal.altitude > 0) {
        const setResult = Astronomy.SearchRiseSet(body, observer, -1, now, 2)
        return {
          status: 'visible',
          statusLabel: 'Visible',
          timeLabel: setResult ? `Set ${formatTime(setResult.date)}` : 'Above horizon',
        }
      }
      const riseResult = Astronomy.SearchRiseSet(body, observer, 1, now, 2)
      return {
        status: 'pending',
        statusLabel: 'Pending',
        timeLabel: riseResult ? `Rise ${formatTime(riseResult.date)}` : 'Below horizon',
      }
    }
  }

  return fromNextEvent(events, now)
}
