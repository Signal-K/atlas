import type { SkyEvent } from './db'

/** Great-circle distance in kilometres. */
export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number

/** Radius, in km, within which a located event counts as local to an observer. */
export const LOCAL_EVENT_RADIUS_KM: number

/** True when the event carries no usable coordinates (absent, or PocketBase's 0/0 sentinel). */
export function hasNoRealLocation(event: Pick<SkyEvent, 'latitude' | 'longitude'>): boolean

/** True when the event is either unlocated (globally visible) or within LOCAL_EVENT_RADIUS_KM. */
export function isLocalEvent(event: SkyEvent, lat: number, lon: number): boolean

/** Distance in km, or null when the event carries no real coordinates. */
export function localEventDistanceKm(event: SkyEvent, lat: number, lon: number): number | null
