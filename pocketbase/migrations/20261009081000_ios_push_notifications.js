migrate((app) => {
  const users = app.findCollectionByNameOrId('users')

  const rule = 'user = @request.auth.id'
  const preferences = new Collection({
    type: 'base',
    name: 'atlas_notification_preferences',
    listRule: rule,
    viewRule: rule,
    createRule: rule,
    updateRule: rule,
    deleteRule: rule,
    fields: [
      { name: 'user', type: 'relation', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
      { name: 'clear_sky', type: 'bool' },
      { name: 'sky_events', type: 'bool' },
      { name: 'challenges', type: 'bool' },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_atlas_notification_preferences_user ON atlas_notification_preferences (user)',
    ],
  })
  app.save(preferences)

  const devices = new Collection({
    type: 'base',
    name: 'atlas_push_devices',
    listRule: rule,
    viewRule: rule,
    createRule: rule,
    updateRule: rule,
    deleteRule: rule,
    fields: [
      { name: 'user', type: 'relation', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
      { name: 'platform', type: 'text', required: true },
      { name: 'token', type: 'text', required: true },
      { name: 'push_enabled', type: 'bool' },
      { name: 'clear_sky_enabled', type: 'bool' },
      { name: 'sky_events_enabled', type: 'bool' },
      { name: 'challenges_enabled', type: 'bool' },
      { name: 'device_name', type: 'text' },
      { name: 'locale', type: 'text' },
      { name: 'time_zone', type: 'text' },
      { name: 'last_seen_at', type: 'date' },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_atlas_push_devices_user_token ON atlas_push_devices (user, token)',
      'CREATE INDEX idx_atlas_push_devices_platform ON atlas_push_devices (platform)',
    ],
  })
  app.save(devices)
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId('atlas_notification_preferences'))
  } catch {
    // Collection may already be absent after partial rollback.
  }
  try {
    app.delete(app.findCollectionByNameOrId('atlas_push_devices'))
  } catch {
    // Collection may already be absent after partial rollback.
  }
})
