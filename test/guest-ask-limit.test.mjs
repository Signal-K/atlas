import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  GUEST_ASK_LIMIT,
  guestAskDecision,
  isGuestAskBurstMessage,
  isGuestAskLimitMessage,
  readGuestAskUsed,
  writeGuestAskUsed,
} from '../src/lib/guestAskLimit.mjs'

test('guests can ask three questions and the fourth is refused', () => {
  assert.equal(GUEST_ASK_LIMIT, 3)
  assert.deepEqual(guestAskDecision(0), { allowed: true, remaining: 3 })
  assert.deepEqual(guestAskDecision(2), { allowed: true, remaining: 1 })
  assert.deepEqual(guestAskDecision(3), { allowed: false, remaining: 0 })
  assert.equal(isGuestAskLimitMessage('TooManyRequestsError guest_ask_limit'), true)
  assert.equal(isGuestAskBurstMessage('guest_ask_burst'), true)
  assert.equal(isGuestAskLimitMessage('Ask Atlas is not enabled'), false)
})

test('a stored guest count resets on the next UTC day', () => {
  const now = new Date('2026-10-13T23:30:00.000Z')
  const stored = writeGuestAskUsed(3, now)
  assert.equal(readGuestAskUsed(stored, now), 3)
  assert.equal(readGuestAskUsed(stored, new Date('2026-10-14T00:05:00.000Z')), 0)
  assert.equal(readGuestAskUsed('not-json', now), 0)
})

test('the Ask Atlas hook limits guests on the server and still requires Sky Pass for accounts', async () => {
  const hook = await readFile(new URL('../pocketbase/pb_hooks/ask-atlas.pb.js', import.meta.url), 'utf8')
  const migration = await readFile(new URL('../pocketbase/migrations/20261013120000_atlas_guest_questions.js', import.meta.url), 'utf8')

  assert.match(hook, /guest_ask_limit/)
  assert.match(hook, /GUEST_ASK_LIMIT = 3/)
  assert.match(hook, /guest_ask_burst/)
  assert.match(hook, /user\.get\('entitled'\)/)
  assert.doesNotMatch(hook, /\$apis\.requireAuth\(\)/)
  assert.match(hook, /\$os\.getenv\('ANTHROPIC_API_KEY'\)/)
  assert.match(migration, /atlas_guest_questions/)
  assert.match(migration, /listRule: null/)
  assert.match(migration, /idx_atlas_guest_questions_ip_day/)
})
