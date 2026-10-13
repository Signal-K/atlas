import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeLocationResults, reconcilePlace } from '../src/lib/locationRank.mjs'

const curated = [
  { name: 'Zurich', lat: 47.3769, lon: 8.5417, country: 'Switzerland', timeZone: 'Europe/Zurich' },
  { name: 'Denver', lat: 39.7392, lon: -104.9903, admin1: 'Colorado', country: 'United States', timeZone: 'America/Denver' },
]

test('Swiss coordinates labelled as Kansas resolve to Zurich, Switzerland', () => {
  const place = reconcilePlace(
    { name: 'Zurich', lat: 47.38, lon: 8.54, admin1: 'Kansas', country: 'United States', timeZone: 'America/Chicago' },
    curated,
  )
  assert.equal(place.name, 'Zurich')
  assert.equal(place.country, 'Switzerland')
  assert.equal(place.timeZone, 'Europe/Zurich')
  assert.equal(place.admin1, undefined)
})

test('the real Zurich, Kansas stays in the United States', () => {
  const place = reconcilePlace(
    { name: 'Zurich', lat: 39.23445, lon: -99.43816, admin1: 'Kansas', country: 'United States', timeZone: 'America/Chicago' },
    curated,
  )
  assert.equal(place.country, 'United States')
  assert.equal(place.admin1, 'Kansas')
  assert.equal(place.timeZone, 'America/Chicago')
})

test('search keeps Switzerland ahead of the Kansas hamlet and does not merge them', () => {
  const results = mergeLocationResults('zurich', curated, [
    { name: 'Zurich', lat: 39.23445, lon: -99.43816, admin1: 'Kansas', country: 'United States', population: 99, timeZone: 'America/Chicago' },
    { name: 'Zurich', lat: 47.36667, lon: 8.55, admin1: 'Zurich', country: 'Switzerland', population: 415367, timeZone: 'Europe/Zurich' },
  ])
  assert.equal(results[0].country, 'Switzerland')
  assert.ok(results.some((city) => city.admin1 === 'Kansas' && city.country === 'United States'))
})
