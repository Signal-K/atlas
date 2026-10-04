import { expect, test, type Page } from '@playwright/test'
import { seedSignedInUser } from './support/auth'

// ASV-107: WCAG 2.5.5 target size and 1.4.11/1.4.3 contrast for the account
// form and the controls the review measured under 44px.

async function smallTargets(page: Page, selector: string) {
  return page.locator(selector).evaluateAll((nodes) => nodes
    .map((node) => ({ name: (node.getAttribute('aria-label') || node.textContent || '').trim().slice(0, 40), box: node.getBoundingClientRect() }))
    .filter(({ box }) => box.width > 0 && (box.height < 43.5 || box.width < 43.5))
    .map(({ name, box }) => `${name}: ${Math.round(box.width)}x${Math.round(box.height)}`))
}

test('calendar controls are at least 44px on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seedSignedInUser(page, { entitled: false })
  await page.goto('/app/calendar')
  await expect(page.getByRole('button', { name: 'Next month' })).toBeVisible()
  expect(await smallTargets(page, '.az-calendar-head button, .az-calendar-grid button')).toEqual([])
})

test('journal secondary links are at least 44px tall on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seedSignedInUser(page, { entitled: false })
  await page.goto('/app/journal')
  const links = page.locator('.az-text-btn')
  await expect(links.first()).toBeVisible()
  const heights = await links.evaluateAll((nodes) => nodes.filter((n) => (n as HTMLElement).offsetParent).map((n) => n.getBoundingClientRect().height))
  expect(heights.length).toBeGreaterThan(0)
  for (const height of heights) expect(height).toBeGreaterThanOrEqual(43.5)
})

function luminance([r, g, b]: number[]) {
  const [R, G, B] = [r, g, b].map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}
const ratio = (a: number[], b: number[]) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05) }

test('account form inputs meet border and placeholder contrast', async ({ page }) => {
  // The sign-in form is what this measures; a returning device opens on it.
  await page.addInitScript(() => window.localStorage.setItem('atlas-returning-account', '1'))
  await page.goto('/app/journal')
  const input = page.locator('.auth-gate-modal .account-form-field input').first()
  await expect(input).toBeVisible()
  const colours = await input.evaluate((el) => {
    const parse = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)
    const style = getComputedStyle(el)
    const placeholder = getComputedStyle(el, '::placeholder')
    return { border: parse(style.borderTopColor), bg: parse(style.backgroundColor), placeholder: parse(placeholder.color), placeholderOpacity: placeholder.opacity }
  })
  expect(ratio(colours.border, colours.bg), 'input border vs background').toBeGreaterThanOrEqual(3)
  expect(ratio(colours.placeholder, colours.bg), 'placeholder vs background').toBeGreaterThanOrEqual(4.5)
  expect(Number(colours.placeholderOpacity)).toBe(1)
})

test('create-account (Clerk) fields have a visible edge and are not clipped', async ({ page }) => {
  // Create account is the default tab for first-time guests, and Clerk draws the
  // field edge with box-shadow (border is 0), so measure that ring, not `border`.
  await page.setViewportSize({ width: 402, height: 874 })
  await page.addInitScript(() => window.localStorage.setItem('atlas-returning-account', '1'))
  await page.goto('/app/journal')
  await page.locator('.account-mode-tabs button', { hasText: 'Create account' }).click()
  const input = page.locator('.auth-gate-modal .cl-formFieldInput').first()
  await expect(input).toBeVisible()
  const { ring, bg, cardOverflow } = await input.evaluate((el) => {
    const parse = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)
    const style = getComputedStyle(el)
    return {
      ring: parse(style.boxShadow.split(/\)\s*,/)[0]),
      bg: parse(style.backgroundColor),
      cardOverflow: getComputedStyle(el.closest('.cl-cardBox') as Element).overflowX,
    }
  })
  expect(ratio(ring, bg), 'Clerk field ring vs background').toBeGreaterThanOrEqual(3)
  expect(cardOverflow, 'card box must not clip the ring or label').toBe('visible')
})
