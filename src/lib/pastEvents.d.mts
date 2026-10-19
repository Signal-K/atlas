import type { SkyEvent } from './db'

/**
 * Every deterministically-computable event overlapping the civil day
 * `dayKey` ('YYYY-MM-DD'), computed on demand from the same generators the
 * ingest seed uses. Never reads `sky_events`: that collection only ever
 * holds a forward window.
 */
export function fetchPastEventsForDay(dayKey: string): Promise<SkyEvent[]>

/** The prefix every generated past-event id carries -- `past-`. */
export const PAST_EVENT_ID_PREFIX: string

/**
 * Whether an id names a generated past event rather than a `sky_events` row.
 *
 * True means the id must never be sent to PocketBase as a relation: there is
 * no row to relate to, and the server rejects the whole record rather than
 * nulling the field.
 */
export function isGeneratedPastEventId(id: string | undefined | null): boolean
