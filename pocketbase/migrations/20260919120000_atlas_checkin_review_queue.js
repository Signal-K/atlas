// CI mirror of backend/migrations/40_atlas_checkin_review_queue.go, which is
// the real production migration. Registered in backend/atlas-migrations-manifest.json
// as "ported" so scripts/sync-atlas-migrations.py does NOT stage this into
// backend/pb_migrations/ -- staging it would create the collection there and
// then Go 40 would try to create it again. (That ordering is real: this
// filename sorts before 40_ because '2' < '4', and a duplicate collection name
// throws, which rolls back the whole pending batch and stops the server from
// starting. Go 40 still guards its own create with an existence check.)
//
// Keep the two files in step. The collector here is the human half of
// backdated check-ins: a past night the photo matcher could not tie to a real
// event, or a Sky Pass backdate with no photo at all.
migrate((app) => {
  try {
    app.findCollectionByNameOrId('atlas_checkin_review_queue')
    return // already created -- by the Go migration above, or out of band
  } catch {
    // Absent -- fall through and create it.
  }

  const users = app.findCollectionByNameOrId('users')

  // Owner-only, deliberately stricter than the photo-challenge collection's
  // `approved = true || user = @request.auth.id`. Approved submissions there
  // are public content; nothing in the app reads anyone else's check-ins, and
  // an approved-or-mine rule here would leak every user's home coordinates and
  // travel dates to every authenticated account. Reviewers read rows as a
  // superuser in the admin UI, which bypasses rules entirely.
  const rule = 'user = @request.auth.id'

  const queue = new Collection({
    type: 'base',
    name: 'atlas_checkin_review_queue',
    listRule: rule,
    viewRule: rule,
    createRule: rule,
    updateRule: rule,
    deleteRule: rule,
    fields: [
      { name: 'user', type: 'relation', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
      // The Dexie row id (a client crypto.randomUUID). The unique index below
      // is what makes a re-push idempotent.
      { name: 'local_id', type: 'text', required: true },
      { name: 'observed_at', type: 'date', required: true },
      // Separate from observed_at: when the photo carried no timezone the
      // disputed value is the civil day, not the instant.
      { name: 'day_key', type: 'text', required: true },
      { name: 'day_ambiguous', type: 'bool' },
      { name: 'location_label', type: 'text', required: true },
      // 0/0 means unset -- a NumberField has no null in PocketBase.
      { name: 'latitude', type: 'number' },
      { name: 'longitude', type: 'number' },
      { name: 'anchor_source', type: 'select', maxSelect: 1, values: ['trip', 'trip-plan', 'journal-location', 'current-location', 'manual'] },
      // Text, not a relation: the candidate is a generated, non-persisted
      // event, so there is no row to relate to.
      { name: 'event_id', type: 'text' },
      // The generated event as the client saw it. Without it the reviewer
      // sees a dangling id.
      { name: 'event_snapshot', type: 'json' },
      { name: 'observation_remote_id', type: 'text' },
      // Not a file field: the photo is already in R2 via
      // uploadObservationPhoto(observationId, photo), which is the one media
      // path. A file field would be a second one with different retention.
      { name: 'photo_r2_key', type: 'text', max: 255 },
      { name: 'photo_r2_size', type: 'number' },
      { name: 'note', type: 'text' },
      { name: 'matched_by', type: 'select', maxSelect: 1, values: ['photo-exif', 'photo-exif-heading', 'manual'] },
      { name: 'match_confidence', type: 'select', maxSelect: 1, values: ['strong', 'possible', 'weak', 'none'] },
      { name: 'status', type: 'select', maxSelect: 1, values: ['pending', 'approved', 'rejected'] },
      { name: 'review_note', type: 'text' },
      { name: 'reviewed_at', type: 'date' },
      // Required twice over: the client sorts the queue by `-created`, and the
      // status index below names the column. A base collection does NOT get
      // created/updated for free -- the admin UI is what normally declares them.
      { name: 'created', type: 'autodate', onCreate: true },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_atlas_checkin_review_queue_user_local ON atlas_checkin_review_queue (user, local_id)',
      'CREATE INDEX idx_atlas_checkin_review_queue_status ON atlas_checkin_review_queue (status, created)',
    ],
  })

  app.save(queue)
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId('atlas_checkin_review_queue'))
  } catch {
    // Collection may already be absent when rolling back a partial migration.
  }
})
