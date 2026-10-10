import { useCallback, useEffect, useState } from 'react'
import { Sheet } from './mobile/Sheet'
import { InterestsPicker } from './InterestsPicker'
import { ChoiceChips } from './onboarding/ChoiceChips'
import { useAuth } from '../lib/auth'
import { db } from '../lib/db'
import { pb } from '../lib/pocketbase'
import { EXPERIENCE_LEVELS, getOnboardingAnswers, saveOnboardingAnswers } from '../lib/onboarding'
import type { ExperienceLevel } from '../lib/onboarding'
import { ONBOARDING_SURVEY_CHOICES, getPurposeChips, savePurposeChips } from '../lib/onboardingSurvey'
import { getPreferredEventTypes, savePreferredEventTypes } from '../lib/eventPreferences'
import { resolveSightingKinds } from '../lib/progressSnapshot'
import { getActiveTripPlan } from '../lib/tripPlans'
import { buildTrainingPath, evaluateTrainingPath, nextPathStep } from '../lib/trainingPath'
import type { PathProfile, PathStep } from '../lib/trainingPath'

const LOCAL_USER_ID = 'local'

function isExperienceLevel(value: unknown): value is ExperienceLevel {
  return EXPERIENCE_LEVELS.some((level) => level.id === value)
}

// The account field wins once onboarding has synced it; the staged local answer
// covers guests and accounts that skipped the question.
function currentExperienceLevel(): ExperienceLevel | null {
  const fromAccount = pb.authStore.record?.experience_level
  return isExperienceLevel(fromAccount) ? fromAccount : getOnboardingAnswers().experienceLevel
}

export function TrainingPathCard() {
  const { user } = useAuth()
  const userId = user?.id ?? LOCAL_USER_ID
  const firstTourBadge = user?.firstTourBadge ?? null
  const [profile, setProfile] = useState<PathProfile | null>(null)
  const [steps, setSteps] = useState<PathStep[]>([])
  const [editing, setEditing] = useState(false)

  const load = useCallback(async () => {
    const [interestKinds, purposeChips, observations, tripPlan] = await Promise.all([
      getPreferredEventTypes(),
      getPurposeChips(userId),
      db.observations.where('userId').equals(userId).toArray(),
      user ? getActiveTripPlan() : Promise.resolve(null),
    ])
    const next: PathProfile = { experienceLevel: currentExperienceLevel(), interestKinds, purposeChips }
    const sightingKinds = await resolveSightingKinds(observations)
    setProfile(next)
    setSteps(evaluateTrainingPath(buildTrainingPath(next), { observations, tripPlan, firstTourBadge, sightingKinds }))
  }, [user, userId, firstTourBadge])

  useEffect(() => {
    load().catch(() => {})
    window.addEventListener('atlas:event-preferences-changed', load)
    return () => window.removeEventListener('atlas:event-preferences-changed', load)
  }, [load])

  if (!profile || steps.length === 0) {
    return (
      <section className="az-card az-training-path-placeholder" style={{ marginTop: '0.75rem' }} aria-hidden="true">
        <div className="az-card-body">
          <span className="az-kicker">Next step on your path</span>
          <div className="az-skeleton" style={{ height: '1.25rem', marginTop: '0.625rem' }} />
          <div className="az-skeleton" style={{ height: '0.875rem', marginTop: '0.5rem' }} />
          <div className="az-skeleton" style={{ height: '4.75rem', marginTop: '0.875rem' }} />
        </div>
      </section>
    )
  }

  const next = nextPathStep(steps)

  async function toggleInterest(categoryKinds: string[]) {
    if (!profile) return
    const active = categoryKinds.every((kind) => profile.interestKinds.includes(kind))
    const kinds = active
      ? profile.interestKinds.filter((kind) => !categoryKinds.includes(kind))
      : [...new Set([...profile.interestKinds, ...categoryKinds])]
    await savePreferredEventTypes(kinds)
  }

  async function toggleChip(chip: string) {
    if (!profile) return
    const chips = profile.purposeChips.includes(chip) ? profile.purposeChips.filter((entry) => entry !== chip) : [...profile.purposeChips, chip]
    await savePurposeChips(userId, chips)
    await load()
  }

  async function chooseExperience(level: ExperienceLevel) {
    saveOnboardingAnswers({ experienceLevel: level })
    await load()
  }

  return (
    <section className="az-card" style={{ marginTop: '0.75rem' }} aria-label="Your training path">
      <div className="az-card-body">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
          <span className="az-kicker">{next ? 'Next step on your path' : 'Path complete'}</span>
          <button type="button" className="az-text-btn" onClick={() => setEditing(true)}>
            Edit path
          </button>
        </div>
        {next && (
          <p style={{ margin: '0.25rem 0 0.125rem' }}>
            <strong>{next.title}</strong>
          </p>
        )}
        {next && (
          <p className="az-muted" style={{ margin: 0, fontSize: '0.8125rem' }}>
            {next.detail}
          </p>
        )}
        <ol style={{ listStyle: 'none', margin: '0.75rem 0 0', padding: 0, display: 'grid', gap: '0.375rem' }}>
          {steps.map((step) => (
            <li key={step.id} data-path-step={step.id} data-state={step.done ? 'done' : 'open'} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.8125rem', opacity: step.done ? 0.6 : 1 }}>
              <span>{step.title}</span>
              <span className="az-muted">{step.done ? 'Done' : 'To do'}</span>
            </li>
          ))}
        </ol>
      </div>

      <Sheet open={editing} title="Edit your path" onClose={() => setEditing(false)}>
        <p className="az-muted" style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem' }}>What do you want to see?</p>
        <InterestsPicker selected={[...profile.interestKinds]} onToggleCategory={(kinds) => void toggleInterest(kinds)} />
        <p className="az-muted" style={{ margin: '1rem 0 0.5rem', fontSize: '0.8125rem' }}>How much astronomy have you done?</p>
        <ChoiceChips
          ariaLabel="Experience"
          options={EXPERIENCE_LEVELS.map((level) => ({ id: level.id, label: level.label }))}
          selected={profile.experienceLevel ? [profile.experienceLevel] : []}
          onToggle={(id) => void chooseExperience(id)}
        />
        <p className="az-muted" style={{ margin: '1rem 0 0.5rem', fontSize: '0.8125rem' }}>What do you want to use Atlas for?</p>
        <ChoiceChips
          ariaLabel="What you want to use Atlas for"
          options={ONBOARDING_SURVEY_CHOICES.map((choice) => ({ id: choice, label: choice }))}
          selected={[...profile.purposeChips]}
          onToggle={(id) => void toggleChip(id)}
        />
      </Sheet>
    </section>
  )
}
