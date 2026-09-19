// The free/Sky Pass difference, which is exactly one cell of a 2x2.
//
// The assertion that matters is the negative one: three of the four
// combinations must be photo-optional. Tonight's check-in works without a photo
// today, so a rule that quietly started requiring one for free users would take
// away something that already ships.
import assert from 'node:assert/strict'
import test from 'node:test'
import { checkInPolicyFor, PhotoRequiredError } from '../src/lib/checkInRules.ts'

const KINDS = ['tonight', 'past']
const TIERS = [true, false] // entitled

test('exactly one of the four combinations requires a photo', () => {
  const requiring = []
  for (const kind of KINDS) {
    for (const entitled of TIERS) {
      if (checkInPolicyFor(kind, entitled).photoRequired) requiring.push([kind, entitled])
    }
  }

  assert.deepEqual(requiring, [['past', false]], 'a free user backdating, and nothing else')
})

test('tonight is photo-optional for everyone, free included', () => {
  // The regression this guards: making the photo a general free-tier rule
  // instead of a backdating rule, which would break check-ins that work today.
  for (const entitled of TIERS) {
    const policy = checkInPolicyFor('tonight', entitled)
    assert.equal(policy.photoRequired, false, `tonight/entitled=${entitled}`)
    assert.equal(policy.photoRequiredReason, null)
  }
})

test('Sky Pass backdates without a photo', () => {
  const policy = checkInPolicyFor('past', true)

  assert.equal(policy.photoRequired, false)
  assert.equal(policy.photoRequiredReason, null)
})

test('a blocked policy always carries the reason it is blocked', () => {
  // The sheet renders `photoRequiredReason` verbatim next to the disabled
  // button. A `photoRequired: true` with no reason would be a dead end with no
  // explanation, so the two fields are tied together.
  const policy = checkInPolicyFor('past', false)

  assert.equal(policy.photoRequired, true)
  assert.ok(policy.photoRequiredReason, 'blocked implies an explanation')
  assert.match(policy.photoRequiredReason, /Sky Pass/, 'and it must name the way forward')
  assert.match(policy.photoRequiredReason, /photo/i)
})

test('the policy reports the kind it was asked about', () => {
  assert.equal(checkInPolicyFor('tonight', false).kind, 'tonight')
  assert.equal(checkInPolicyFor('past', true).kind, 'past')
})

test('PhotoRequiredError carries the same reason the sheet would show', () => {
  const error = new PhotoRequiredError()

  assert.equal(error.name, 'PhotoRequiredError')
  assert.equal(error.message, checkInPolicyFor('past', false).photoRequiredReason)
  assert.ok(error instanceof Error)
})
