import { getFavouriteEventTypes, saveEventTypeFavourites } from './favourites'

const COMPLETED_KEY = 'atlas-event-preferences-completed'

export async function getPreferredEventTypes(): Promise<string[]> {
  return getFavouriteEventTypes()
}

export function hasCompletedEventPreferences(): boolean {
  return localStorage.getItem(COMPLETED_KEY) === '1'
}

export async function savePreferredEventTypes(kinds: string[]): Promise<void> {
  await saveEventTypeFavourites(kinds)
  localStorage.setItem(COMPLETED_KEY, '1')
  window.dispatchEvent(new Event('atlas:event-preferences-changed'))
}
