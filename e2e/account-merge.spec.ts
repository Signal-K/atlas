import { expect, test } from '@playwright/test'

test('local first-journey data merges into account and deduplicates saved records', async ({ page }) => {
  await page.goto('/')

  const result = await page.evaluate(async () => {
    const [{ db }, { mergeLocalDataIntoAccount }] = await Promise.all([
      import('/src/lib/db.ts'),
      import('/src/lib/accountMerge.ts'),
    ])
    await db.delete()
    await db.open()
    window.localStorage.clear()

    const now = new Date().toISOString()
    window.localStorage.setItem(
      'atlas-first-plan-target-taps',
      JSON.stringify([
        {
          targetId: 'moon-event',
          title: 'Full Moon',
          kind: 'moon_phase',
          tappedAt: now,
          source: 'tonight',
          locationLabel: 'London',
        },
        {
          targetId: 'iss-event',
          title: 'ISS Pass',
          kind: 'iss_pass',
          tappedAt: now,
          source: 'mobile_hub',
          locationLabel: 'London',
        },
      ]),
    )
    window.localStorage.setItem('atlas-first-plan-equipment', 'phone')

    await db.favourites.bulkPut([
      { id: 'local-fav-moon', userId: 'local', kind: 'target', value: 'moon' },
      { id: 'existing-fav-moon', userId: 'user-1', kind: 'target', value: 'moon' },
      { id: 'local-fav-mars', userId: 'local', kind: 'target', value: 'mars' },
    ])
    await db.watchlist.bulkPut([
      { id: 'local-watch-moon', userId: 'local', favouriteId: 'local-fav-moon', notifyOnGoodViewing: true },
      { id: 'existing-watch-moon', userId: 'user-1', favouriteId: 'existing-fav-moon', notifyOnGoodViewing: true },
      { id: 'local-watch-mars', userId: 'local', favouriteId: 'local-fav-mars', notifyOnGoodViewing: true },
    ])
    await db.observations.add({
      id: 'local-observation',
      userId: 'local',
      observedAt: now,
      note: 'Saw the Moon.',
      targetName: 'Moon',
    })
    await db.cameraPresets.add({
      id: 'local-preset',
      userId: 'local',
      device: 'iphone_15_pro',
      targetKey: 'moon',
      name: 'Moon handheld',
      settings: { mode: 'Night mode' },
      source: 'imported',
      createdAt: now,
    })

    const merge = await mergeLocalDataIntoAccount('user-1')
    const favourites = await db.favourites.toArray()
    const watchlist = await db.watchlist.toArray()
    const observations = await db.observations.toArray()
    const presets = await db.cameraPresets.toArray()

    return {
      merge,
      favourites,
      watchlist,
      observations,
      presets,
      taps: JSON.parse(window.localStorage.getItem('atlas-first-plan-target-taps') ?? '[]'),
      equipment: window.localStorage.getItem('atlas-first-plan-equipment'),
    }
  })

  expect(result.merge).toMatchObject({
    favourites: 1,
    watchlist: 1,
    observations: 1,
    cameraPresets: 1,
    targetTaps: 2,
    equipmentChoice: 1,
    total: 7,
  })
  expect(result.favourites.filter((item) => item.userId === 'local')).toHaveLength(0)
  expect(result.favourites.filter((item) => item.userId === 'user-1' && item.kind === 'target' && item.value === 'moon')).toHaveLength(1)
  expect(result.favourites.find((item) => item.value === 'mars')).toMatchObject({ userId: 'user-1' })
  expect(result.watchlist.filter((item) => item.userId === 'local')).toHaveLength(0)
  expect(result.watchlist.filter((item) => item.favouriteId === 'existing-fav-moon')).toHaveLength(1)
  expect(result.observations).toEqual([expect.objectContaining({ id: 'local-observation', userId: 'user-1' })])
  expect(result.presets).toEqual([expect.objectContaining({ id: 'local-preset', userId: 'user-1' })])
  expect(result.taps).toHaveLength(2)
  expect(result.equipment).toBe('phone')
})
