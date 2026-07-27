// Prefill data handed from a Tonight target's "Log attempt" button to the
// Scrapbook form. Lives outside both views since App.tsx owns the hand-off
// between tabs (there's no router/query-string to carry it through).
export interface ObservationDraft {
  eventId: string
  targetName: string
  deviceUsed?: string
  cameraRecipeUsed?: string
  locationLabel?: string
  // Conditions at the moment "Log attempt" was tapped -- already computed
  // by whichever view is handing off the draft (moon phase, cloud cover,
  // the target's compass direction), reused by ScrapbookView to suggest a
  // starting caption instead of a blank textbox. Best-effort: any/all may
  // be omitted if the calling view didn't have them on hand.
  moonIlluminationPct?: number
  cloudCoverPct?: number
  directionLabel?: string
}
