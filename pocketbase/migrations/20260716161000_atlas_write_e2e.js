migrate((app) => {
  const users = app.findCollectionByNameOrId('users')
  const observationsRule = 'user = @request.auth.id'
  const observations = new Collection({
    type: 'base',
    name: 'atlas_observations',
    listRule: observationsRule,
    viewRule: observationsRule,
    createRule: observationsRule,
    updateRule: observationsRule,
    deleteRule: observationsRule,
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
        name: 'observed_at',
        type: 'date',
        required: true,
      },
      {
        name: 'note',
        type: 'text',
      },
    ],
  })
  app.save(observations)
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId('atlas_observations'))
  } catch {
    // Collection may already be absent when rolling back a partial migration.
  }
})
