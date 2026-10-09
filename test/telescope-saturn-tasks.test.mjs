import assert from 'node:assert/strict'
import test from 'node:test'
import { SATURN_STORM_WATCH_FALLBACK, SATURN_TASKS, visibleSaturnTasks } from '../src/lib/telescopeSaturnTasks.mjs'

const ids = (result) => result.tasks.map((task) => task.id)

test('people without a telescope get the Saturn Storm Watch fallback', () => {
  const result = visibleSaturnTasks({ hasTelescope: false, now: new Date('2026-10-06T12:00:00Z') })
  assert.deepEqual(result.tasks, [])
  assert.equal(result.fallback, SATURN_STORM_WATCH_FALLBACK)
})

test('every task links to where its data goes', () => {
  for (const task of SATURN_TASKS) {
    assert.ok(task.links.length > 0, task.id)
    for (const link of task.links) assert.match(link.url, /^https?:\/\//)
  }
})

test('badge is gold inside the event period and silver outside it', () => {
  const during = visibleSaturnTasks({ hasTelescope: true, now: new Date('2026-10-06T12:00:00Z') })
  assert.equal(during.tasks.find((t) => t.id === 'saturn-rings-pvol').badge, 'gold')
  const after = visibleSaturnTasks({ hasTelescope: true, now: new Date('2026-12-01T12:00:00Z') })
  assert.equal(after.tasks.find((t) => t.id === 'saturn-rings-pvol'), undefined)
  assert.equal(after.tasks.find((t) => t.id === 'jupiter-mutual-events').badge, 'gold')
})

test('a task before its window is silver while still upcoming', () => {
  const before = visibleSaturnTasks({ hasTelescope: true, now: new Date('2026-09-01T00:00:00Z') })
  assert.equal(before.tasks.find((t) => t.id === 'saturn-rings-pvol').badge, 'silver')
})

test('occultation tasks stay hidden until IOTA-ES lists them', () => {
  const now = new Date('2026-10-06T12:00:00Z')
  assert.ok(!ids(visibleSaturnTasks({ hasTelescope: true, now })).some((id) => id.includes('occultation')))
  const listed = SATURN_TASKS.map((task) => (task.id.includes('occultation') ? { ...task, listed: true } : task))
  const shown = visibleSaturnTasks({ hasTelescope: true, now, tasks: listed })
  assert.deepEqual(ids(shown).filter((id) => id.includes('occultation')), ['iapetus-occultation-2027', 'phoebe-occultation-2027'])
  assert.equal(shown.tasks.find((t) => t.id === 'iapetus-occultation-2027').badge, 'silver')
  const onNight = visibleSaturnTasks({ hasTelescope: true, now: new Date('2027-09-17T20:00:00Z'), tasks: listed })
  assert.equal(onNight.tasks.find((t) => t.id === 'iapetus-occultation-2027').badge, 'gold')
})
