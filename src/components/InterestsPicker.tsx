import { EVENT_CATEGORIES } from '../lib/eventCategories'

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
    <div className="interests-picker">
      {OPTIONS.map((category) => {
        const active = category.kinds.every((kind) => selected.includes(kind))
        return (
          <button
            type="button"
            key={category.id}
            className={`interests-picker-chip${active ? ' is-active' : ''}`}
            onClick={() => onToggleCategory(category.kinds)}
            aria-pressed={active}
            style={active ? { borderColor: category.accent, color: category.accent } : undefined}
          >
            {category.label}
          </button>
        )
      })}
    </div>
  )
}

export function categoryLabelsForKinds(kinds: string[]): string[] {
  return OPTIONS.filter((category) => category.kinds.some((kind) => kinds.includes(kind))).map((category) => category.label)
}
