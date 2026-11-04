import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildDeepSkyTonight,
  deepSkyClassFor,
  defaultGearFromEquipment,
  surfaceBrightness,
} from '../src/lib/deepSkyTonight.ts'

// ASV-154. Golden cases: two locations x two dates (a new Moon and a full
// Moon each), so the Moon penalty is exercised both ways.
const CASES = [
  { name: 'London, 9 Nov 2026 (new Moon)', lat: 51.5, lon: -0.12, timeZone: 'Europe/London', now: '2026-11-09T12:00:00Z', moonPct: 1,
    small: ['m39', 'm34', 'm32', 'm1', 'm27', 'm78'] },
  { name: 'London, 24 Nov 2026 (full Moon)', lat: 51.5, lon: -0.12, timeZone: 'Europe/London', now: '2026-11-24T12:00:00Z', moonPct: 100,
    small: ['m39', 'm34', 'm32', 'm94', 'm27', 'm78'] },
  { name: 'Sydney, 9 Nov 2026 (new Moon)', lat: -33.87, lon: 151.21, timeZone: 'Australia/Sydney', now: '2026-11-09T01:00:00Z', moonPct: 0,
    small: ['m47', 'm41', 'm78', 'm42', 'm77', 'm1'] },
  { name: 'Sydney, 24 Nov 2026 (full Moon)', lat: -33.87, lon: 151.21, timeZone: 'Australia/Sydney', now: '2026-11-24T01:00:00Z', moonPct: 100,
    small: ['m47', 'm41', 'm78', 'm77', 'm42', 'm1'] },
]

for (const c of CASES) {
  for (const gear of ['small', 'large']) {
    test(`${c.name}: a ${gear} scope gets at least 5 rewarding targets with time, direction and how-to`, () => {
      const r = buildDeepSkyTonight({ now: new Date(c.now), lat: c.lat, lon: c.lon, timeZone: c.timeZone, gear })
      assert.ok(r.picks.length >= 5, `expected >=5 picks, got ${r.picks.length}`)
      const start = new Date(r.window.start).getTime()
      const end = new Date(r.window.end).getTime()
      for (const p of r.picks) {
        const at = new Date(p.bestAt).getTime()
        assert.ok(at >= start && at <= end, `${p.id} best time is inside the dark window`)
        assert.ok(p.altitudeDeg >= 25, `${p.id} is high enough to be worth it`)
        assert.ok(p.direction.length > 0 && p.compassLabel.length > 0)
        assert.ok(p.howTo.length > 20)
        assert.ok(p.rating >= 0 && p.rating <= 100)
      }
      const ratings = r.picks.map((p) => p.rating)
      assert.deepEqual(ratings, [...ratings].sort((a, b) => b - a), 'picks are best first')
      assert.ok(new Set(r.picks.map((p) => p.deepSkyClass)).size >= 3, 'picks span at least three classes')
    })
  }

  test(`${c.name}: golden small-scope picks`, () => {
    const r = buildDeepSkyTonight({ now: new Date(c.now), lat: c.lat, lon: c.lon, timeZone: c.timeZone, gear: 'small' })
    assert.equal(r.moon.illuminationPct >= c.moonPct - 5 && r.moon.illuminationPct <= c.moonPct + 5, true)
    assert.deepEqual(r.picks.map((p) => p.id), c.small)
  })
}

test('the dark window is the same night for any clock time on the same evening', () => {
  const base = { lat: 51.5, lon: -0.12, timeZone: 'Europe/London', gear: 'small' }
  const noon = buildDeepSkyTonight({ ...base, now: new Date('2026-11-09T12:00:00Z') })
  const lateEvening = buildDeepSkyTonight({ ...base, now: new Date('2026-11-09T20:00:00Z') })
  assert.equal(noon.window.end, lateEvening.window.end)
  assert.ok(new Date(lateEvening.window.start) >= new Date('2026-11-09T20:00:00Z'), 'never recommends a moment that has already passed')
  // 02:00 local is still the previous evening's night.
  const afterMidnight = buildDeepSkyTonight({ ...base, now: new Date('2026-11-10T02:00:00Z') })
  assert.equal(afterMidnight.window.end, noon.window.end)
})

test('bigger gear never reaches fewer objects than smaller gear', () => {
  const base = { now: new Date('2026-11-09T12:00:00Z'), lat: 51.5, lon: -0.12, timeZone: 'Europe/London', limit: 200 }
  const count = (gear) => buildDeepSkyTonight({ ...base, gear }).picks.length
  assert.ok(count('eye') <= count('binoculars'))
  assert.ok(count('binoculars') <= count('small'))
  assert.ok(count('small') <= count('large'))
})

test('a full Moon penalises glowing clouds and galaxies more than star clusters', () => {
  const base = { lat: 51.5, lon: -0.12, timeZone: 'Europe/London', gear: 'large', limit: 200 }
  const full = buildDeepSkyTonight({ ...base, now: new Date('2026-11-24T12:00:00Z') })
  const penalties = (cls) => full.picks.filter((p) => p.deepSkyClass === cls && p.moonSeparationDeg !== null).map((p) => p.moonPenalty / 1)
  const cluster = penalties('cluster')
  const galaxy = penalties('galaxy')
  if (cluster.length && galaxy.length) {
    const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
    assert.ok(mean(galaxy) >= mean(cluster), 'galaxies lose at least as much as clusters')
  }
  assert.ok(full.picks.some((p) => p.moonPenalty > 0), 'the Moon costs something on at least one pick')
})

test('surface brightness spreads the same light over a bigger area', () => {
  // 0.5 deg across = 30 arcmin; same magnitude over twice the diameter is
  // 2.5 * log10(4) = ~1.5 mag/arcmin^2 fainter.
  const small = surfaceBrightness(8, 0.25)
  const large = surfaceBrightness(8, 0.5)
  assert.ok(Math.abs(large - small - 2.5 * Math.log10(4)) < 1e-9)
})

test('catalogue types map to plain-language classes', () => {
  assert.equal(deepSkyClassFor('nebula'), 'nebula')
  assert.equal(deepSkyClassFor('reflection nebula'), 'nebula')
  assert.equal(deepSkyClassFor('cluster + nebula'), 'nebula')
  assert.equal(deepSkyClassFor('planetary nebula'), 'dying-star')
  assert.equal(deepSkyClassFor('supernova remnant'), 'dying-star')
  assert.equal(deepSkyClassFor('globular cluster'), 'cluster')
  assert.equal(deepSkyClassFor('open cluster'), 'cluster')
  assert.equal(deepSkyClassFor('galaxy'), 'galaxy')
  assert.equal(deepSkyClassFor('double star'), null)
})

test('onboarding equipment picks the default gear', () => {
  assert.equal(defaultGearFromEquipment('telescope'), 'small')
  assert.equal(defaultGearFromEquipment('binoculars'), 'binoculars')
  assert.equal(defaultGearFromEquipment('eyes'), 'eye')
  assert.equal(defaultGearFromEquipment('phone'), 'eye')
  assert.equal(defaultGearFromEquipment(null), 'eye')
})
