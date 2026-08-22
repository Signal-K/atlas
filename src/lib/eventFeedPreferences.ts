const TAGGED_ONLY_DEFAULT_KEY = 'atlas-event-feed-tagged-only-default'

// Whether the events feed should default to showing only tagged events.
// Same localStorage-flag + change-event shape as eventPreferences.ts's
// hasCompletedEventPreferences/savePreferredEventTypes.
export function defaultsToTaggedOnly(): boolean {
  return localStorage.getItem(TAGGED_ONLY_DEFAULT_KEY) === '1'
}

export function setDefaultsToTaggedOnly(value: boolean): void {
  if (value) {
    localStorage.setItem(TAGGED_ONLY_DEFAULT_KEY, '1')
  } else {
    localStorage.removeItem(TAGGED_ONLY_DEFAULT_KEY)
  }
  window.dispatchEvent(new Event('atlas:event-feed-prefs-changed'))
}
