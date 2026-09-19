// The four questions this overhaul added to first-run onboarding: what the
// user observes with, how much astronomy they've done, whether they belong to
// a local club, and what they actually want Atlas for.
//
// Presentational only -- values in, changes out, no state and no persistence.
// OnboardingFlow owns the answers and decides when they're saved or staged, so
// these stay cheap to read and impossible to get subtly out of sync with the
// step machine.
import { EXPERIENCE_LEVELS, type ExperienceLevel } from '../../lib/onboarding'
import { ONBOARDING_SURVEY_CHOICES } from '../../lib/onboardingSurvey'
import { VIEWING_INSTRUMENTS } from '../../lib/tripPlans'
import { ChoiceChips } from './ChoiceChips'

const H1_STYLE = { fontSize: '2rem', margin: '0.5rem 0 0.5rem' } as const
const MUTED_STYLE = { margin: '0 0 1.25rem', fontSize: '0.90625rem' } as const

export function EquipmentStep({ selected, onToggle }: { selected: string[]; onToggle: (id: string) => void }) {
  return (
    <>
      <h1 className="az-h1" style={H1_STYLE}>
        What will you observe with?
      </h1>
      <p className="az-muted" style={MUTED_STYLE}>
        Pick everything you might use — Atlas uses this to suggest targets that are actually within reach.
      </p>
      <ChoiceChips
        ariaLabel="Viewing equipment"
        options={VIEWING_INSTRUMENTS.map((instrument) => ({
          id: instrument.id,
          // The stored id stays `naked_eye` so this answer lines up with the
          // trip planner and profile filters, but "Naked eye" alone reads
          // oddly to someone who thinks of their phone as the instrument.
          label: instrument.id === 'naked_eye' ? 'Just my eyes or my phone' : instrument.label,
        }))}
        selected={selected}
        onToggle={onToggle}
      />
    </>
  )
}

export function ExperienceStep({ selected, onSelect }: { selected: ExperienceLevel | null; onSelect: (level: ExperienceLevel) => void }) {
  const hint = EXPERIENCE_LEVELS.find((level) => level.id === selected)?.hint
  return (
    <>
      <h1 className="az-h1" style={H1_STYLE}>
        How much astronomy have you done?
      </h1>
      <p className="az-muted" style={MUTED_STYLE}>
        No wrong answer — this only changes how much Atlas explains as you go.
      </p>
      <ChoiceChips
        ariaLabel="Experience level"
        options={EXPERIENCE_LEVELS}
        selected={selected ? [selected] : []}
        onToggle={onSelect}
      />
      {/* The descriptions are too long to sit inside a nowrap chip, so only
          the chosen one is spelled out underneath. */}
      {hint && (
        <p className="az-muted" style={{ margin: '0.875rem 0 0', fontSize: '0.8125rem' }}>
          {hint}
        </p>
      )}
    </>
  )
}

export function ClubsStep({
  inClub,
  clubName,
  onSelectInClub,
  onClubNameChange,
}: {
  inClub: boolean | null
  clubName: string
  onSelectInClub: (inClub: boolean) => void
  onClubNameChange: (name: string) => void
}) {
  return (
    <>
      <h1 className="az-h1" style={H1_STYLE}>
        Part of a local astronomy club?
      </h1>
      <p className="az-muted" style={MUTED_STYLE}>
        Atlas can point you at local meet-ups and dark-sky nights if there are any nearby.
      </p>
      <ChoiceChips
        ariaLabel="Astronomy club membership"
        options={[
          { id: 'yes', label: 'Yes' },
          { id: 'no', label: 'No' },
        ]}
        selected={inClub === null ? [] : [inClub ? 'yes' : 'no']}
        onToggle={(answer) => onSelectInClub(answer === 'yes')}
      />
      {/* Optional even after saying yes: plenty of people belong to something
          informal and won't want to type it, and "in a club, didn't name it"
          is a more useful thing to know than a forced blank. */}
      {inClub && (
        <input
          type="text"
          className="az-input"
          style={{ marginTop: '0.875rem' }}
          value={clubName}
          onChange={(event) => onClubNameChange(event.target.value)}
          placeholder="Which club? (optional)"
          maxLength={120}
        />
      )}
    </>
  )
}

export function SurveyStep({ selected, onToggle }: { selected: string[]; onToggle: (choice: string) => void }) {
  return (
    <>
      <h1 className="az-h1" style={H1_STYLE}>
        What do you want to use Atlas for?
      </h1>
      <p className="az-muted" style={MUTED_STYLE}>
        Last one — pick as many as apply.
      </p>
      <ChoiceChips
        ariaLabel="What you want to use Atlas for"
        options={ONBOARDING_SURVEY_CHOICES.map((choice) => ({ id: choice, label: choice }))}
        selected={selected}
        onToggle={onToggle}
      />
    </>
  )
}
