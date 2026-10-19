import { EVENT_CATEGORIES } from '../lib/eventCategories'
import { ChoiceChips } from './onboarding/ChoiceChips'

// Shared category chip grid for picking event-type interests -- used by
// both the desktop feed's interests summary (WeekConditionsStrip) and the
// first-run OnboardingFlow, backed by the same store as mobile's
// EventPreferencePrompt (src/lib/eventPreferences.ts) so a choice made on
// one surface is immediately reflected on the others.
const OPTIONS = EVENT_CATEGORIES.filter((category) => category.id !== 'guides')

export function InterestsPicker({
  selected,
  onToggleCategory,
}: {
  selected: string[]
  onToggleCategory: (categoryKinds: string[]) => void
}) {
  return (
    <ChoiceChips
      ariaLabel="What you want to see"
      // `selected` holds event *kinds*, but a chip is one category covering
      // several kinds at once, so a category reads as active only when every
      // one of its kinds is present -- the same all-or-nothing rule the
      // previous hand-rolled version used.
      selected={OPTIONS.filter((category) => category.kinds.every((kind) => selected.includes(kind))).map((category) => category.id)}
      options={OPTIONS.map((category) => ({ id: category.id, label: category.label }))}
      onToggle={(id) => {
        const category = OPTIONS.find((option) => option.id === id)
        if (category) onToggleCategory(category.kinds)
      }}
    />
  )
}

export function categoryLabelsForKinds(kinds: string[]): string[] {
  return OPTIONS.filter((category) => category.kinds.some((kind) => kinds.includes(kind))).map((category) => category.label)
}
