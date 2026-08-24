migrate((app) => {
  const users = app.findCollectionByNameOrId('users')
  const rule = 'user = @request.auth.id'
  const queue = new Collection({
    type: 'base',
    name: 'atlas_push_confirmation_queue',
    listRule: rule,
    viewRule: rule,
    createRule: rule,
    updateRule: rule,
    deleteRule: rule,
    fields: [
      { name: 'user', type: 'relation', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
      { name: 'local_id', type: 'text', required: true },
      { name: 'event_id', type: 'text', required: true },
      { name: 'title', type: 'text', required: true },
      { name: 'created_at', type: 'date', required: true },
      { name: 'sent_at', type: 'date' },
      { name: 'last_error', type: 'text' },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_atlas_push_confirmation_queue_user_local ON atlas_push_confirmation_queue (user, local_id)',
      'CREATE INDEX idx_atlas_push_confirmation_queue_pending ON atlas_push_confirmation_queue (sent_at, created_at)',
    ],
  })
  app.save(queue)
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId('atlas_push_confirmation_queue'))
  } catch {
    // Collection may already be absent when rolling back a partial migration.
  }
})
