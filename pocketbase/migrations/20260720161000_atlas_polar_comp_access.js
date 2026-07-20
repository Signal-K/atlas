migrate((app) => {
  const compAccess = new Collection({
    type: 'base',
    name: 'atlas_polar_comp_access',
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        name: 'email_normalized',
        type: 'text',
        required: true,
      },
      {
        name: 'discount_id',
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
        name: 'reason',
        type: 'text',
      },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_atlas_polar_comp_access_email ON atlas_polar_comp_access (email_normalized)',
      'CREATE INDEX idx_atlas_polar_comp_access_active ON atlas_polar_comp_access (active, expires_at)',
    ],
  })

  app.save(compAccess)
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId('atlas_polar_comp_access'))
  } catch {
    // Collection may already be absent when rolling back a partial migration.
  }
})
