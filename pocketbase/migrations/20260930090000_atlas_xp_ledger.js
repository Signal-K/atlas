// CI/local mirror of backend/migrations/43_atlas_xp_ledger.go, which is the
// real production migration (ASV-93). Registered in
// backend/atlas-migrations-manifest.json as "ported" so
// scripts/sync-atlas-migrations.py does NOT stage this into
// backend/pb_migrations/ -- a second create of the same collection would throw
// and roll back the whole pending batch. Both files guard with an existence
// check. Keep the two in step.
//
// Append-only XP ledger: one row per (user, action, source_id). The unique
// index is what makes a retried save a no-op. Update/delete rules are null
// (superuser only); list/view/create are owner-only.
migrate((app) => {
  try {
    app.findCollectionByNameOrId('atlas_xp_ledger')
    return // already created -- by the Go migration, or out of band
  } catch {
    // Absent -- fall through and create it.
  }

  const users = app.findCollectionByNameOrId('users')
  const rule = 'user = @request.auth.id'

  const ledger = new Collection({
    type: 'base',
    name: 'atlas_xp_ledger',
    listRule: rule,
    viewRule: rule,
    createRule: rule,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: 'user', type: 'relation', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
      { name: 'action', type: 'text', required: true, max: 64 },
      { name: 'source_id', type: 'text', required: true, max: 255 },
      { name: 'skill', type: 'select', required: true, maxSelect: 1, values: ['observing', 'photography', 'planning', 'community'] },
      { name: 'points', type: 'number', required: true, onlyInt: true, min: 0, max: 1000 },
      { name: 'event_kind', type: 'text', max: 64 },
      { name: 'created', type: 'autodate', onCreate: true },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_atlas_xp_ledger_user_action_source ON atlas_xp_ledger (user, action, source_id)',
    ],
  })

  app.save(ledger)
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId('atlas_xp_ledger'))
  } catch {
    // Already absent when rolling back a partial migration.
  }
})
