import { useState } from 'react'
import {
  ONBOARDING_VERSION,
  hasCompletedOnboardingFlow,
  markOnboardingComplete,
  markOnboardingRequired,
  requiresOnboardingFlow,
} from '../lib/onboarding'
import { accountOnboardingVersion, syncOnboardingToAccount, type AuthUser } from '../lib/auth'

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
  // ASV-47: being *on* a product route is itself proof of having entered.
  // Gating solely on the click-through flag meant a guest who deep-linked or
  // reloaded straight into /app/hub never saw onboarding, and therefore never
  // got the location step -- leaving them on the hardcoded Melbourne default,
  // which is the exact failure this work exists to remove.
  const hasClickedIntoApp = Boolean(user) || isAppRoute || localStorage.getItem(ENTERED_KEY) === '1'

  // A returning authenticated account should not be treated like a
  // brand-new signup just because this browser has no local
  // onboarding-complete flag -- but it also must not be exempted from a flow
  // it has never seen. Both signals are *versions*, not booleans: the local
  // flag records which flow this browser last finished, and the account's
  // `onboarding_version` (synced server-side by OnboardingFlow's finish(), see
  // lib/auth.ts's syncOnboardingToAccount) records the same across devices.
  // The account-side check is what makes this correct on a new browser, and
  // the version comparison is what makes an existing account that finished an
  // older, shorter flow go through the current one.
  //
  // The explicit requirement (an interrupted run, or a test forcing the flow)
  // outranks both -- someone mid-flow must resume rather than be waved past it
  // by a device that happens to have finished.
  const [onboardingFlowDismissed, setOnboardingFlowDismissed] = useState(
    () =>
      !requiresOnboardingFlow() &&
      (hasCompletedOnboardingFlow() || Boolean(user && user.onboardingVersion >= ONBOARDING_VERSION)),
  )

  const showOnboardingFlow = hasClickedIntoApp && isAppRoute && !onboardingFlowDismissed

  function markEntered() {
    localStorage.setItem(ENTERED_KEY, '1')
  }

  // ASV-53: this used to call markOnboardingComplete() unconditionally, which
  // was correct only while "has onboarded at all" was the same question as
  // "has onboarded with the current flow". With a versioned flow it silently
  // answers the second question yes for every existing account -- a returning
  // user signs in, gets stamped as having completed a flow they were never
  // shown, and never sees the new steps. So the exemption now depends on a
  // version that actually satisfies the gate.
  function handleSignedIn() {
    const accountIsCurrent = accountOnboardingVersion() >= ONBOARDING_VERSION
    if (!requiresOnboardingFlow() && (hasCompletedOnboardingFlow() || accountIsCurrent)) {
      markOnboardingComplete()
      // This browser finished the current flow but the account is behind: a
      // guest who completed onboarding and only then signed in. Push the
      // staged answers onto the account rather than dropping them, which is
      // also what stops this from being re-run on their next device.
      if (!accountIsCurrent) void syncOnboardingToAccount()
      setOnboardingFlowDismissed(true)
      return
    }
    markOnboardingRequired()
    setOnboardingFlowDismissed(false)
  }

  function handleSignedUp() {
    // ASV-47: guests now reach Hub without an account, and onboarding runs
    // when they enter rather than after sign-up. Someone who set their
    // location, gear and interests as a guest and only then created an
    // account has already answered all of it -- re-requiring the flow would
    // walk them through the same four steps a second time. Treat a completed
    // guest onboarding as done and sync it onto the new account instead.
    if (hasCompletedOnboardingFlow()) {
      void syncOnboardingToAccount()
      setOnboardingFlowDismissed(true)
      return
    }
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
