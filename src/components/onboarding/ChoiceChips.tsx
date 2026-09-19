// The one chip grid the onboarding steps share. Extracted rather than inlined
// per step so the equipment, experience and interest pickers can't drift apart
// visually -- they are the same control with different contents, and the
// three of them sit two steps apart in the same flow.
//
// Wraps by default: .az-chip sets `white-space: nowrap`, so a row of
// multi-word labels overflows the overlay on a phone without it.
export function ChoiceChips<T extends string>({
  options,
  selected,
  onToggle,
  ariaLabel,
}: {
  options: { id: T; label: string }[]
  selected: T[]
  onToggle: (id: T) => void
  ariaLabel?: string
}) {
  return (
    <div className="az-chip-row" style={{ flexWrap: 'wrap' }} role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = selected.includes(option.id)
        return (
          <button
            key={option.id}
            type="button"
            className={`az-chip${active ? ' is-active' : ''}`}
            aria-pressed={active}
            onClick={() => onToggle(option.id)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
