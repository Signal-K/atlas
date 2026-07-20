migrate((app) => {
  const users = app.findCollectionByNameOrId('users')

  const rule = 'user = @request.auth.id'
  const reminders = new Collection({
    type: 'base',
    name: 'atlas_get_ready_reminders',
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
        name: 'local_id',
        type: 'text',
        required: true,
      },
      {
        name: 'event_id',
        type: 'text',
        required: true,
      },
      {
        name: 'title',
        type: 'text',
        required: true,
      },
      {
        name: 'kind',
        type: 'text',
      },
      {
        name: 'target',
        type: 'text',
      },
      {
        name: 'starts_at',
        type: 'date',
        required: true,
      },
      {
        name: 'ends_at',
        type: 'date',
      },
      {
        name: 'remind_at',
        type: 'date',
        required: true,
      },
      {
        name: 'device_name',
        type: 'text',
        required: true,
      },
      {
        name: 'latitude',
        type: 'number',
      },
      {
        name: 'longitude',
        type: 'number',
      },
      {
        name: 'direction_label',
        type: 'text',
      },
      {
        name: 'cloud_cover_pct',
        type: 'number',
      },
      {
        name: 'precipitation_chance_pct',
        type: 'number',
      },
      {
        name: 'fired_at',
        type: 'date',
      },
      {
        name: 'skipped_reason',
        type: 'text',
      },
      {
        name: 'last_error',
        type: 'text',
      },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_atlas_get_ready_reminders_user_event ON atlas_get_ready_reminders (user, event_id)',
      'CREATE INDEX idx_atlas_get_ready_reminders_due ON atlas_get_ready_reminders (remind_at, fired_at)',
    ],
  })

  app.save(reminders)
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId('atlas_get_ready_reminders'))
  } catch {
    // Collection may already be absent when rolling back a partial migration.
  }
})
