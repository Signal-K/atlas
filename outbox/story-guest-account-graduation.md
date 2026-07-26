---
id: story-guest-account-graduation
type: story
epic: epic-guest-experience
title: Reframe the signup prompt as an offer, with a permanent Settings graduation path
status: done
priority: medium
---

# Reframe the signup prompt as an offer, with a permanent Settings graduation path

**As a** guest using Atlas without an account
**I want** signing up to feel like an optional offer, with a clear,
always-available way to do it later
**So that** declining doesn't feel like losing something, and I'm not
stuck if I change my mind.

Liam's exact ask: "it should be 'would you like to sign up?', if not,
save that in browser, but have a permanent fixture in the settings to
allow them to graduate to a full account and save their data in the
browser to a real account."

## What was already true

Turned out the core mechanics already existed:
- Declining the signup prompt never affected the save — it was already
  written to the browser (Dexie/`localStorage`, scoped to a fixed
  `'local'` id) before the prompt even renders
  (`src/components/SignupWallModal.tsx`'s own header comment already
  says this).
- `src/views/AccountSettings.tsx` is already the permanent
  fixture — it's unconditionally rendered at the top of Settings
  (`SettingsView.tsx`, shared by desktop and mobile via
  `MobileShell.tsx`), and already calls `mergeLocalDataIntoAccount()` on
  sign-up to carry every local favourite/watchlist/observation/camera
  preset over.

So this was a copy/framing problem, not a missing-feature problem.

## Acceptance criteria

- [x] The signup prompt (`SignupWallModal`) reads as a direct yes/no
      offer, not an implicit requirement.
- [x] It explicitly reassures that declining keeps the save in the
      browser, and points to Settings for later.
- [x] The permanent Settings fixture (`AccountSettings`, signed-out
      state) explicitly states the same thing proactively, not only
      after the fact via the post-signup `SignupWelcomeBeat`.

## Implementation

`src/components/SignupWallModal.tsx`: title changed from
"Keep this watch target"/"Keep this observation" to "Sign up to sync?";
body changed from an implicit "Create a free account to keep this..." to
a direct "Would you like to sync this [watch target/observation] across
your devices?"; added a line above the dismiss button: "No account
needed to keep using Atlas — this already saved in your browser. Create
one any time from Settings."

`src/views/AccountSettings.tsx`: added a paragraph above the sign-in/
sign-up form (signed-out state only) stating plainly that everything
saved in the browser stays there account-or-not, and that creating an
account later syncs it without losing anything already saved.

Verified with a Playwright screenshot against the live Settings page —
the guest-facing copy renders as intended above the form.
