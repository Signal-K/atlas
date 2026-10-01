import { test, expect } from '@playwright/test'
import { seedSignedInUser } from './support/auth'

// ASV-86. Saving tonight's session reports the points that save added.

test('tonight check-in toast shows the points that save earned', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seedSignedInUser(page)
  await page.addInitScript(() => {
    const w = window as unknown as { __atlasEvents: { name: string; properties: Record<string, unknown> }[] }
    w.__atlasEvents = []
    window.addEventListener('atlas:analytics-event', (e) => w.__atlasEvents.push((e as CustomEvent).detail))
  })
  await page.goto('/app/journal')

  await page.getByRole('button', { name: "Log tonight's session" }).click()
  await page.getByPlaceholder('What did you see tonight?').fill('Clear skies, saw Jupiter.')
  await page.getByRole('button', { name: 'Save session' }).click()

  await expect(page.getByText('Session logged · +10 pts. Next: First photo published.')).toBeVisible()

  // ASV-91: the same save emits the award and the milestone to analytics.
  const events = await page.evaluate(() => (window as unknown as { __atlasEvents: { name: string; properties: Record<string, unknown> }[] }).__atlasEvents)
  expect(events.find((e) => e.name === 'Progress awarded')?.properties).toMatchObject({ action: 'check_in', skill: 'observing', points: 10 })
  expect(events.find((e) => e.name === 'Milestone unlocked')?.properties).toMatchObject({ milestone: 'first-check-in' })
})
