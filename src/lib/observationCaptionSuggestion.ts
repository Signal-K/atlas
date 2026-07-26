import type { ObservationDraft } from './observationDraft'

// Metadata-driven "smart caption" suggestion (no vision/AI call, no
// network) -- Atlas already computed the target's direction and the
// night's moon/cloud conditions before the user ever tapped "Log
// attempt," so a plausible starting caption can be built straight from
// that instead of leaving the field blank. Purely a starting point: the
// user can edit or clear it before saving, same as a placeholder, just a
// much more specific one.
export function suggestObservationCaption(draft: ObservationDraft): string {
  const parts: string[] = [`Looked for ${draft.targetName}`]

  if (draft.directionLabel) parts.push(`toward ${draft.directionLabel}`)

  const conditionParts: string[] = []
  if (draft.cloudCoverPct != null) {
    const cloudDescriptor = draft.cloudCoverPct < 20 ? 'clear' : draft.cloudCoverPct < 60 ? 'partly cloudy' : 'cloudy'
    conditionParts.push(`${cloudDescriptor} sky (${Math.round(draft.cloudCoverPct)}% cloud)`)
  }
  if (draft.moonIlluminationPct != null) {
    conditionParts.push(`moon ${Math.round(draft.moonIlluminationPct)}% lit`)
  }

  const opening = parts.join(' ') + '.'
  return conditionParts.length > 0 ? `${opening} ${conditionParts.join(', ')}.` : opening
}
