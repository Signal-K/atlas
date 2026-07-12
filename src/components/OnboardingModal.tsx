import { useState } from 'react'
import { authErrorMessage, signIn, signUp } from '../lib/auth'
import { saveEventTypeFavourites } from '../lib/favourites'

const EVENT_KINDS = [
  { id: 'moon_phase', label: 'Moon phases' },
  { id: 'meteor_shower', label: 'Meteor showers' },
  { id: 'eclipse', label: 'Eclipses' },
  { id: 'iss_pass', label: 'ISS passes' },
  { id: 'conjunction', label: 'Planet/Moon conjunctions' },
]

export const ONBOARDING_COMPLETE_KEY = 'atlas-onboarding-complete'

export function OnboardingModal({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<'account' | 'preferences'>('account')
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-up')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [selectedKinds, setSelectedKinds] = useState<Set<string>>(new Set())

  async function handleAuthSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'sign-in') await signIn(email, password)
      else await signUp(email, password)
      setStep('preferences')
    } catch (error) {
      const fallback = mode === 'sign-in' ? 'Sign-in failed — check your email and password.' : 'Sign-up failed.'
      setError(authErrorMessage(error, fallback))
    } finally {
      setBusy(false)
    }
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
        {step === 'account' ? (
          <>
            <h2>Welcome to Atlas</h2>
            <p>Create an account to sync your notes and pins across devices — or skip and use it fully offline.</p>
            <form className="account-form" onSubmit={handleAuthSubmit}>
              <input type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />
              <div className="account-form-actions">
                <button type="submit" disabled={busy}>
                  {mode === 'sign-in' ? 'Sign in' : 'Create account'}
                </button>
                <button type="button" className="account-form-switch" onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}>
                  {mode === 'sign-in' ? 'Need an account?' : 'Have an account?'}
                </button>
              </div>
              {error && <p className="account-form-error">{error}</p>}
            </form>
            <button type="button" className="onboarding-skip" onClick={() => setStep('preferences')}>
              Skip for now
            </button>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  )
}
