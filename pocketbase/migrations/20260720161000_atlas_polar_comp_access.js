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

  const grant = new Record(compAccess)
  grant.set('email_normalized', 'liam@skinetics.tech')
  grant.set('discount_id', '2b3c24e3-f354-4843-aa7b-865df2ba73d5')
  grant.set('active', true)
  grant.set('reason', 'founder_test_comp')
  app.save(grant)
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId('atlas_polar_comp_access'))
  } catch {
    // Collection may already be absent when rolling back a partial migration.
  }
})
