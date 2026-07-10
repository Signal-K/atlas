// Prefill data handed from a Tonight target's "Log attempt" button to the
// Scrapbook form. Lives outside both views since App.tsx owns the hand-off
// between tabs (there's no router/query-string to carry it through).
export interface ObservationDraft {
  eventId: string
  targetName: string
  deviceUsed?: string
  cameraRecipeUsed?: string
  locationLabel?: string
}
