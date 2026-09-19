import { test, expect, type Page } from '@playwright/test'
import { seedSignedInUser } from './support/auth'

// Regression coverage for the mobile auto-zoom: tapping a text field -- the
// onboarding "What should Atlas call you?" field was the one that got
// reported -- zoomed the whole interface in.
//
// The mechanism is that WebKit zooms the viewport whenever a focused form
// control's *computed* font-size is under 16px, and Android Chrome reflows
// the page on focus via text autosizing. The fix is the invariant block in
// src/index.css plus the 1rem declarations in atlas.css.
//
// Why assert the computed value in a browser rather than test the stylesheet:
// the bug was never one wrong declaration. It was ~20 controls sitting at
// 0.875rem (14px) and 0.90625rem (14.5px), *plus* `font: inherit` letting
// every unclassed control take its container's 12-13px. A test that greps the
// CSS for "0.875rem" would pass the moment someone renamed a selector, and
// would say nothing about a control that has no rule at all -- which is
// exactly how this shipped. Reading getComputedStyle catches both.
//
// Chromium is enough: the 16px floor is declared unconditionally, not inside
// a media query, so a desktop-width Chromium computes the same value WebKit
// would on the phone. That is also why the floor is unconditional -- see the
// comment in src/index.css.

const MIN_CONTROL_FONT_PX = 16

// Mirrors the selector in the src/index.css invariant, minus the control types
// that render no text (a checkbox has no font-size to zoom on, and forcing
// 1rem on one distorts its intrinsic box, so they're deliberately exempt).
const ZOOMABLE_SELECTORS =
  'input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([type="file"]), select, textarea'

interface UnderSizedControl {
  tag: string
  type: string
  className: string
  placeholder: string
  fontSize: number
}

async function auditControls(page: Page): Promise<{ checked: number; offenders: UnderSizedControl[] }> {
  return page.evaluate(
    ({ selectors, min }) => {
      const all = Array.from(document.querySelectorAll<HTMLElement>(selectors))
      // Only a *visible* control can be focused, and only a focused control
      // triggers the zoom. A control inside a closed sheet is still in the DOM
      // but has no box; counting it would let a vacuous pass look like a real
      // one.
      const visible = all.filter((element) => {
        const style = window.getComputedStyle(element)
        if (style.display === 'none' || style.visibility === 'hidden') return false
        return element.offsetWidth > 0 || element.offsetHeight > 0
      })
      return {
        checked: visible.length,
        offenders: visible
          .map((element) => ({
            tag: element.tagName.toLowerCase(),
            type: element.getAttribute('type') ?? '',
            className: element.className || '(no class)',
            placeholder: element.getAttribute('placeholder') ?? '',
            fontSize: Number.parseFloat(window.getComputedStyle(element).fontSize),
          }))
          .filter((control) => control.fontSize < min),
      }
    },
    { selectors: ZOOMABLE_SELECTORS, min: MIN_CONTROL_FONT_PX },
  )
}

// The single assertion every screen uses. `expectAtLeast` is load-bearing, not
// decoration: Hub, Events, Journal and Profile render *zero* form controls on
// first paint -- their inputs all live behind a sheet or a second tab -- so
// without a floor this spec's green tick would mean "I looked at nothing and
// found nothing wrong" on four of its five route cases. Every call site below
// passes the number of controls the screen is actually known to have, so
// deleting a field (or breaking the selector) fails the test instead of
// silently emptying it.
async function expectNoZoomTargets(page: Page, screen: string, expectAtLeast: number) {
  const { checked, offenders } = await auditControls(page)

  expect(offenders, `${screen}: these controls compute below ${MIN_CONTROL_FONT_PX}px and zoom the viewport on focus`).toEqual([])
  expect(checked, `${screen}: expected at least ${expectAtLeast} visible form control(s) to audit, found ${checked}`).toBeGreaterThanOrEqual(expectAtLeast)
}

test.describe('no form control computes below the iOS auto-zoom threshold', () => {
  test('the onboarding name field and location step', async ({ page }) => {
    // The reported control. onboardingComplete: false is what puts the flow on
    // screen at all -- every other seed here skips straight past it.
    await seedSignedInUser(page, { onboardingComplete: false })
    await page.goto('/app/hub')

    const nameField = page.getByPlaceholder('Your name')
    await expect(nameField).toBeVisible()
    await expectNoZoomTargets(page, 'onboarding / name step', 1)

    // Focus is the exact interaction that used to zoom; asserting it explicitly
    // keeps the test honest about what it's protecting.
    await nameField.focus()
    await expectNoZoomTargets(page, 'onboarding / name step (focused)', 1)

    // The location step is where ASV-35 first saw this, and it renders
    // LocationSearchInput -- the same component the settings sheet and the
    // itinerary/photo sheets use, so it's worth covering where a brand-new
    // user first meets it.
    await nameField.fill('Liam')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.locator('.location-search input')).toBeVisible()
    await expectNoZoomTargets(page, 'onboarding / location step', 1)
  })

  test.describe('signed in', () => {
    test.beforeEach(async ({ page }) => {
      await seedSignedInUser(page, { onboardingComplete: true, entitled: true })
    })

    // These four are guards, not proofs: they hold zero controls today and
    // exist so that the first one added lands under the floor. The `0` floor
    // says so explicitly rather than leaving it to be discovered.
    for (const [path, screen] of [
      ['/app/hub', 'Hub'],
      ['/app/events', 'Events'],
    ] as const) {
      test(`${screen} renders every control at or above ${MIN_CONTROL_FONT_PX}px`, async ({ page }) => {
        await page.goto(path)
        await expect(page.locator('#primary-navigation')).toBeVisible()
        await expectNoZoomTargets(page, screen, 0)
      })
    }

    test('Ask Atlas', async ({ page }) => {
      await page.goto('/app/ask')
      await expect(page.getByRole('heading', { name: 'Ask Atlas', exact: true })).toBeVisible()
      await expectNoZoomTargets(page, 'Ask Atlas', 1)
    })

    test('the Journal capture sheet', async ({ page }) => {
      await page.goto('/app/journal')
      await page.getByRole('button', { name: "Log tonight's session" }).click()
      await expect(page.locator('.az-sheet-body textarea')).toBeVisible()
      await expectNoZoomTargets(page, 'Journal / capture sheet', 1)
    })

    // Two surfaces are deliberately NOT covered here, because reaching their
    // inputs in a browser means driving a flow that has nothing to do with
    // font sizes:
    //
    //  - PhotoSkyIdSheet's <input type="datetime-local"> only renders after a
    //    photo is uploaded and parsed for EXIF.
    //  - AccountManagement's email-confirm input only renders in the
    //    "permanently delete my account" branch.
    //
    // Both are covered by construction -- the floor in src/index.css is
    // unconditional and selector-based, so it cannot be "not applied" the way
    // a per-component rule can -- but that is an argument, not a test. Naming
    // them here so the gap is visible rather than looking like full coverage.

    test('the Profile leaderboard sheet', async ({ page }) => {
      await page.goto('/app/profile')
      await page.getByRole('button', { name: /Streak leaderboard/ }).click()
      await expect(page.locator('.az-sheet-body input').first()).toBeVisible()
      await expectNoZoomTargets(page, 'Profile / leaderboard sheet', 1)
    })

    test('the search overlay', async ({ page }) => {
      await page.goto('/app/hub')
      await page.getByRole('button', { name: 'Search' }).click()
      await expect(page.locator('.az-search-field input')).toBeVisible()
      await expectNoZoomTargets(page, 'Search overlay', 1)
    })

    test('the location sheet', async ({ page }) => {
      await page.goto('/app/hub')
      await page.locator('.az-location-chip').click()
      await expect(page.locator('.location-search input')).toBeVisible()
      await expectNoZoomTargets(page, 'Location sheet', 1)
    })

    // FeedbackDock mounts straight off App(), outside .nav-shell -- so its
    // textareas have no .az-page / .az-sheet-body ancestor and were the most
    // likely place for the `font: inherit` fallthrough to bite.
    test('the feedback dock', async ({ page }) => {
      await page.goto('/app/hub')
      await page.getByRole('button', { name: 'Request feature' }).click()
      await expect(page.locator('.feedback-panel')).toBeVisible()
      await expectNoZoomTargets(page, 'Feedback dock', 1)
    })
  })
})
