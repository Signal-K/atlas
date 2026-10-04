import { test, expect } from '@playwright/test'

const APP_URL = `http://localhost:${process.env.PLAYWRIGHT_PORT || '5173'}`

// ASV-100: the entry-choice dialog renders outside the .atlas-almanac scope
// on the landing branch, so its --am-* tokens were undefined and the dialog
// came out transparent with dark text on a dark overlay.
test('entry-choice dialog is opaque and readable, and Esc closes it', async ({ page }) => {
  await page.goto(`${APP_URL}/`)
  await page.getByRole('button', { name: /see my sky/i }).first().click()

  const dialog = page.getByRole('dialog', { name: /how would you like to begin/i })
  await expect(dialog).toBeVisible()

  const styles = await dialog.evaluate((el) => {
    const cs = getComputedStyle(el)
    return { bg: cs.backgroundColor, color: cs.color }
  })
  expect(styles.bg).not.toBe('rgba(0, 0, 0, 0)')
  expect(styles.bg).not.toBe('transparent')

  await expect(dialog.getByRole('button', { name: /sign in first/i })).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})
