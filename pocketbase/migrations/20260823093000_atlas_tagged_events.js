migrate((app) => {
  const users = app.findCollectionByNameOrId('users')

  const rule = 'user = @request.auth.id'
  const taggedEvents = new Collection({
    type: 'base',
    name: 'atlas_tagged_events',
    listRule: rule,
    viewRule: rule,
    createRule: rule,
    updateRule: rule,
    deleteRule: rule,
    fields: [
      {
        name: 'user',
        type: 'relation',
        required: true,
        maxSelect: 1,
        collectionId: users.id,
        cascadeDelete: true,
      },
      {
        name: 'event_id',
        type: 'text',
        required: true,
      },
      {
        name: 'tagged_at',
        type: 'date',
        required: true,
      },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_atlas_tagged_events_user_event ON atlas_tagged_events (user, event_id)',
    ],
  })

  app.save(taggedEvents)
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId('atlas_tagged_events'))
  } catch {
    // Collection may already be absent when rolling back a partial migration.
  }
})
