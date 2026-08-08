import { useState } from 'react'
import {
  hasCompletedOnboardingFlow,
  markOnboardingComplete,
  markOnboardingRequired,
  requiresOnboardingFlow,
} from '../components/OnboardingFlow'
import type { AuthUser } from '../lib/auth'

// Set once a visitor enters the product from the landing page. The public
// index remains the landing page on every visit; the product lives at /app.
const ENTERED_KEY = 'atlas-entered'

interface UseOnboardingGateArgs {
  user: AuthUser | null
  isAppRoute: boolean
}

/**
 * Tracks whether a visitor has entered the app and whether the first-run
 * onboarding flow should still be shown. Extracted from App.tsx so the app
 * shell is routing/layout only; behavior is unchanged.
 */
export function useOnboardingGate({ user, isAppRoute }: UseOnboardingGateArgs) {
  // Whether *this session* has clicked past the landing page at all --
  // keeps the app shell/onboarding flow visible immediately after
  // enterApp() navigates away from "/", the same as before. Kept separate
  // from onboardingFlowDismissed below: right when someone clicks "Get
  // started," they haven't given a location or finished onboarding yet, so
  // gating onboarding's own visibility on that stricter signal would hide
  // onboarding the instant it's supposed to appear.
  const hasClickedIntoApp = Boolean(user) || localStorage.getItem(ENTERED_KEY) === '1'

  // A returning authenticated account should not be treated like a
  // brand-new signup just because this browser has no local
  // onboarding-complete flag. New signups set a separate persisted
  // requirement below so an interrupted onboarding still resumes after
  // reload. `user.onboarded` (synced server-side by OnboardingFlow's
  // finish(), see lib/auth.ts's syncOnboardingToAccount) is OR'd in on top
  // of that local heuristic: it's what actually makes this correct across
  // devices/browsers, rather than just within a session that happens to
  // remember signing in vs up.
  const [onboardingFlowDismissed, setOnboardingFlowDismissed] = useState(
    () => hasCompletedOnboardingFlow() || Boolean(user?.onboarded) || (Boolean(user) && !requiresOnboardingFlow()),
  )

  const showOnboardingFlow = hasClickedIntoApp && isAppRoute && !onboardingFlowDismissed

  function markEntered() {
    localStorage.setItem(ENTERED_KEY, '1')
  }

  function handleSignedIn() {
    markOnboardingComplete()
    setOnboardingFlowDismissed(true)
  }

  function handleSignedUp() {
    markOnboardingRequired()
    setOnboardingFlowDismissed(false)
  }

  return {
    hasClickedIntoApp,
    onboardingFlowDismissed,
    showOnboardingFlow,
    markEntered,
    handleSignedIn,
    handleSignedUp,
    dismissOnboardingFlow: () => setOnboardingFlowDismissed(true),
  }
}
