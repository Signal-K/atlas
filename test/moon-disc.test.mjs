import assert from 'node:assert/strict'
import test from 'node:test'
import { litAreaFraction, moonLitPath } from '../src/lib/moonDisc.mjs'

const DISC = { cx: 100, cy: 60, r: 42 }

function parse(path) {
  const arcs = [...path.matchAll(/A ([\d.]+) ([\d.]+) 0 0 ([01])/g)]
  assert.equal(arcs.length, 2, `expected two arcs in ${path}`)
  return {
    limb: { rx: Number(arcs[0][1]), sweep: Number(arcs[0][3]) },
    terminator: { rx: Number(arcs[1][1]), sweep: Number(arcs[1][3]) },
  }
}

function pathFor(illuminatedFraction, overrides = {}) {
  return moonLitPath({ ...DISC, illuminatedFraction, ...overrides })
}

test('the terminator collapses to a straight line at half phase', () => {
  // rx = 0 makes the arc degenerate, which SVG renders as a line -- a
  // half-lit disc. The old implementation rendered solid black here.
  assert.equal(parse(pathFor(0.5)).terminator.rx, 0)
})

test('the terminator widens to the full radius at new and full moon', () => {
  assert.equal(parse(pathFor(0)).terminator.rx, DISC.r)
  assert.equal(parse(pathFor(1)).terminator.rx, DISC.r)
})

test('new moon encloses nothing and full moon encloses the whole disc', () => {
  // At both extremes rx equals the limb radius, so the only thing separating
  // "all dark" from "all lit" is the sweep flag: matching the limb retraces
  // it (zero area), opposing it completes the circle.
  const newMoon = parse(pathFor(0))
  assert.notEqual(newMoon.terminator.sweep, newMoon.limb.sweep)
  assert.equal(litAreaFraction(0), 0)

  const fullMoon = parse(pathFor(1))
  assert.equal(fullMoon.terminator.sweep, fullMoon.limb.sweep)
  assert.equal(litAreaFraction(1), 1)
})

test('crescents curve toward the lit limb and gibbous phases away from it', () => {
  const crescent = parse(pathFor(0.25))
  assert.notEqual(crescent.terminator.sweep, crescent.limb.sweep)

  const gibbous = parse(pathFor(0.75))
  assert.equal(gibbous.terminator.sweep, gibbous.limb.sweep)

  // Same illumination distance either side of half phase, same terminator
  // width -- the phases are mirror images, not different shapes.
  assert.equal(crescent.terminator.rx, gibbous.terminator.rx)
})

test('enclosed area equals the illuminated fraction at every phase', () => {
  for (const k of [0, 0.1, 0.25, 0.42, 0.5, 0.66, 0.75, 0.9, 1]) {
    assert.ok(
      Math.abs(litAreaFraction(k) - k) < 1e-12,
      `lit area ${litAreaFraction(k)} should equal illumination ${k}`,
    )
  }
})

test('waning mirrors waxing, and the southern hemisphere mirrors both', () => {
  const waxingNorth = parse(pathFor(0.3, { waxing: true })).limb.sweep
  const waningNorth = parse(pathFor(0.3, { waxing: false })).limb.sweep
  assert.notEqual(waxingNorth, waningNorth)

  const waxingSouth = parse(pathFor(0.3, { waxing: true, southernHemisphere: true })).limb.sweep
  assert.equal(waxingSouth, waningNorth)

  // Two flips cancel: a waning moon seen from the south matches a waxing moon
  // seen from the north.
  const waningSouth = parse(pathFor(0.3, { waxing: false, southernHemisphere: true })).limb.sweep
  assert.equal(waningSouth, waxingNorth)
})

test('out-of-range illumination is clamped rather than inverting the geometry', () => {
  assert.equal(parse(pathFor(1.4)).terminator.rx, DISC.r)
  assert.equal(parse(pathFor(-0.2)).terminator.rx, DISC.r)
  assert.equal(parse(pathFor(Number.NaN)).terminator.rx, DISC.r)
})
