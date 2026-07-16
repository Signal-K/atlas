import { useState } from 'react'
import { useAuth } from './auth'
import type { SignupWallReason } from '../components/SignupWallModal'

const DISMISSED_KEY = 'atlas-signup-wall-dismissed'

// Triggers the signup-wall prompt after a signed-out save action (STS-320).
// The save itself already happened locally before this is called -- this
// only decides whether to also show the upsell, and stays quiet for the
// rest of the session once dismissed once.
export function useSignupWall() {
  const { user } = useAuth()
  const [reason, setReason] = useState<SignupWallReason | null>(null)

  function promptAfterSave(nextReason: SignupWallReason) {
    if (user) return
    if (localStorage.getItem(DISMISSED_KEY) === '1') return
    setReason(nextReason)
  }

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setReason(null)
  }

  function complete() {
    setReason(null)
  }

  return { reason, promptAfterSave, dismiss, complete }
}
