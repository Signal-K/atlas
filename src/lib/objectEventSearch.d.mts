import type { SkyEvent } from './db'

export interface SearchableSkyObject {
  id: string
  name: string
  kind?: string
  detail?: string
}

export interface ObjectEventSearchResult extends SearchableSkyObject {
  events: SkyEvent[]
}

export function findObjectEventResults(
  objects: SearchableSkyObject[],
  events: SkyEvent[],
  query: string,
  options?: { objectLimit?: number; eventLimit?: number; nowMs?: number },
): ObjectEventSearchResult[]
