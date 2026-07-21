migrate((app) => {
  const users = app.findCollectionByNameOrId('users')

  const links = new Collection({
    type: 'base',
    name: 'atlas_demo_access_links',
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        name: 'code',
        type: 'text',
        required: true,
      },
      {
        name: 'active',
        type: 'bool',
      },
      {
        name: 'expires_at',
        type: 'date',
      },
      {
        name: 'max_redemptions',
        type: 'number',
      },
      {
        name: 'redemption_count',
        type: 'number',
      },
      {
        name: 'reason',
        type: 'text',
      },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_atlas_demo_access_links_code ON atlas_demo_access_links (code)',
      'CREATE INDEX idx_atlas_demo_access_links_active ON atlas_demo_access_links (active, expires_at)',
    ],
  })
  app.save(links)

  const redemptions = new Collection({
    type: 'base',
    name: 'atlas_demo_access_redemptions',
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        name: 'link',
        type: 'relation',
        required: true,
        maxSelect: 1,
        collectionId: links.id,
        cascadeDelete: true,
      },
      {
        name: 'user',
        type: 'relation',
        required: true,
        maxSelect: 1,
        collectionId: users.id,
        cascadeDelete: true,
      },
      {
        name: 'email_normalized',
        type: 'text',
        required: true,
      },
      {
        name: 'code',
        type: 'text',
        required: true,
      },
      {
        name: 'reason',
        type: 'text',
      },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_atlas_demo_access_redemptions_user_link ON atlas_demo_access_redemptions (user, link)',
      'CREATE INDEX idx_atlas_demo_access_redemptions_email ON atlas_demo_access_redemptions (email_normalized)',
    ],
  })
  app.save(redemptions)
}, (app) => {
  for (const collection of ['atlas_demo_access_redemptions', 'atlas_demo_access_links']) {
    try {
      app.delete(app.findCollectionByNameOrId(collection))
    } catch {
      // Collection may already be absent when rolling back a partial migration.
    }
  }
})
