// Local-only display name for the feed greeting ("Hi, {name}."). Kept as a
// plain localStorage preference like firstPlanJourney's equipment choice --
// there's no PocketBase profile field for this yet, and the greeting should
// still work for signed-out/offline use.
const DISPLAY_NAME_KEY = 'atlas-display-name'

export function getDisplayName(): string | null {
  const value = localStorage.getItem(DISPLAY_NAME_KEY)
  return value && value.trim() ? value.trim() : null
}

export function saveDisplayName(name: string): void {
  const trimmed = name.trim()
  if (trimmed) localStorage.setItem(DISPLAY_NAME_KEY, trimmed)
  else localStorage.removeItem(DISPLAY_NAME_KEY)
}
