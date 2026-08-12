import { expect, test } from '@playwright/test'

test.describe('production sky-event smoke', () => {
  test.skip(process.env.RUN_PRODUCTION_SMOKE !== '1', 'Runs only in the production-assurance workflow')

  test('today catalogue publishes the Perseids and total solar eclipse', async ({ request }) => {
    const pbUrl = process.env.VITE_PB_URL
    expect(pbUrl, 'VITE_PB_URL must point at the production PocketBase service').toBeTruthy()

    const response = await request.get(`${pbUrl}/api/collections/sky_events/records`, {
      params: {
        perPage: '100',
        filter: 'starts_at >= "2026-08-11 00:00:00" && starts_at <= "2026-08-13 23:59:59"',
      },
    })
    expect(response.ok(), await response.text()).toBe(true)
    const body = (await response.json()) as { items: Array<{ kind: string; target: string; title: string }> }

    expect(body.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'meteor_shower', target: 'perseids', title: 'Perseids Meteor Shower' }),
      expect.objectContaining({ kind: 'eclipse', target: 'sun', title: 'Total Solar Eclipse' }),
    ]))
  })
})
