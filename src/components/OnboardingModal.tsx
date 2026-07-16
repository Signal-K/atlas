import { useState } from 'react'
import { saveEventTypeFavourites } from '../lib/favourites'

const EVENT_KINDS = [
  { id: 'moon_phase', label: 'Moon phases' },
  { id: 'meteor_shower', label: 'Meteor showers' },
  { id: 'eclipse', label: 'Eclipses' },
  { id: 'iss_pass', label: 'ISS passes' },
  { id: 'conjunction', label: 'Planet/Moon conjunctions' },
]

export const ONBOARDING_COMPLETE_KEY = 'atlas-onboarding-complete'

// Account creation now happens on the landing page (the first thing a new
// visitor sees), so this modal only ever asks about viewing preferences --
// it used to also offer sign-up/sign-in first, which competed with the
// landing page's own CTA for the same "just arrived" moment.
export function OnboardingModal({ onComplete }: { onComplete: () => void }) {
  const [selectedKinds, setSelectedKinds] = useState<Set<string>>(new Set())

  function notNow() {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, '1')
    onComplete()
  }

  function toggleKind(kind: string) {
    setSelectedKinds((current) => {
      const next = new Set(current)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }

  async function finish() {
    if (selectedKinds.size > 0) {
      await saveEventTypeFavourites([...selectedKinds])
    }
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, '1')
    onComplete()
  }

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-modal">
        <h2>What do you like to see?</h2>
        <p>Pick what you&apos;re most interested in — you can change this later in Settings.</p>
        <div className="onboarding-kinds">
          {EVENT_KINDS.map((kind) => (
            <label key={kind.id} className="onboarding-kind">
              <input type="checkbox" checked={selectedKinds.has(kind.id)} onChange={() => toggleKind(kind.id)} />
              {kind.label}
            </label>
          ))}
        </div>
        <button type="button" className="onboarding-cta-primary" onClick={finish}>
          Get started
        </button>
        <button type="button" className="onboarding-skip" onClick={notNow}>
          Not now
        </button>
      </div>
    </div>
  )
}
