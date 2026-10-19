import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

// The CI mirror of the real Go migration. Asserted as text rather than by
// running it: PocketBase's migrate() needs a live app instance, and the
// properties that matter here are declarative.
const migration = await readFile(
  new URL('../pocketbase/migrations/20260919120000_atlas_checkin_review_queue.js', import.meta.url),
  'utf8',
)

test('the queue collection carries the required atlas_ prefix', () => {
  assert.match(migration, /name:\s*'atlas_checkin_review_queue'/)
})

// The one security-relevant mistake available in this file. Photo challenges
// use `approved = true || user = @request.auth.id` because approved
// submissions are public content; this collection is private location data, so
// an approved-or-mine rule would expose every user's home coordinates and
// travel dates to every authenticated account.
test('access rules are owner-only, with no approved-or-mine widening', () => {
  const rules = [...migration.matchAll(/(listRule|viewRule|createRule|updateRule|deleteRule):\s*([^,\n]+)/g)]
  assert.equal(rules.length, 5, 'expected all five access rules to be declared explicitly')

  for (const [, name, value] of rules) {
    assert.equal(
      value.trim(),
      'rule',
      `${name} must be the owner-only \`rule\` constant; widening it would leak private check-ins`,
    )
  }

  assert.match(migration, /const rule = 'user = @request\.auth\.id'/)

  // The comments explain the contrast with the photo-challenge collection, so
  // strip them before scanning -- otherwise this asserts against the doc
  // rather than the code.
  const code = migration.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  assert.doesNotMatch(code, /approved\s*=\s*true/, 'an approved-or-mine rule must never appear in this migration')
})

// Without 'rejected' a reviewer's only options are approve or delete, and
// deleting a user's own diary entry because a reviewer disagreed is
// unrecoverable. The entry must survive rejection.
test('status carries a terminal rejected state, not just pending and approved', () => {
  const status = migration.match(/name:\s*'status',\s*type:\s*'select',[^}]*values:\s*\[([^\]]+)\]/)
  assert.ok(status, 'expected a status select field')

  const values = status[1].split(',').map((value) => value.trim().replace(/^'|'$/g, ''))
  assert.deepEqual(values, ['pending', 'approved', 'rejected'])
})

test('both indexes are declared', () => {
  // (user, local_id) unique is what makes a re-push idempotent; (status,
  // created) is the pending-backlog scan the digest script performs.
  assert.match(
    migration,
    /CREATE UNIQUE INDEX idx_atlas_checkin_review_queue_user_local ON atlas_checkin_review_queue \(user, local_id\)/,
  )
  assert.match(
    migration,
    /CREATE INDEX idx_atlas_checkin_review_queue_status ON atlas_checkin_review_queue \(status, created\)/,
  )
})

// A base collection does not get created/updated for free -- PocketBase's
// initDefaultFields adds only the id field. The status index names `created`,
// and the client sorts the queue by `-created`, so an undeclared autodate
// would fail the index at migration time.
test('created is declared explicitly so the status index can name it', () => {
  assert.match(migration, /name:\s*'created',\s*type:\s*'autodate',\s*onCreate:\s*true/)
})

// The migration must be safe to apply on a database where the Go migration
// already created the collection: this filename sorts before the Go one
// ('2' < '4'), and a duplicate collection name throws -- which rolls back the
// entire pending batch and stops the server from starting.
test('creation is guarded against a collection that already exists', () => {
  assert.match(migration, /app\.findCollectionByNameOrId\('atlas_checkin_review_queue'\)/)
  assert.match(migration, /already created/)
})
