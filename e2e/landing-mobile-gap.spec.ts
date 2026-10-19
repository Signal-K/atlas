import { expect, test } from '@playwright/test'

// ASV-110: on a phone there was ~150px of dead space under the hero art, whose
// bottom edge also had no border and read as clipped.

test('landing hero art has no large dead gap beneath it and a closed bottom edge', async ({ page }) => {
  await page.setViewportSize({ width: 406, height: 755 })
  await page.goto('/')

  const sky = page.locator('.landing-sky')
  await expect(sky).toBeVisible()
  const gap = await page.evaluate(() => {
    const art = document.querySelector('.landing-sky')!.getBoundingClientRect()
    const next = document.querySelector('.landing-proof')!.getBoundingClientRect()
    const nextContent = document.querySelector('.landing-proof h2, .landing-proof p')!.getBoundingClientRect()
    return { toSection: next.top - art.bottom, toContent: nextContent.top - art.bottom }
  })
  expect(gap.toSection, 'space between hero art and the next section rule').toBeLessThanOrEqual(40)
  expect(gap.toContent, 'space between hero art and the next section content').toBeLessThanOrEqual(140)
  await expect(sky).toHaveCSS('border-bottom-width', '1px')
})
