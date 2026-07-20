migrate((app) => {
  const users = app.findCollectionByNameOrId('users')

  const lightPollutionSamples = new Collection({
    type: 'base',
    name: 'atlas_light_pollution_samples',
    listRule: '',
    viewRule: '',
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        name: 'latitude',
        type: 'number',
        required: true,
      },
      {
        name: 'longitude',
        type: 'number',
        required: true,
      },
      {
        name: 'sample_date',
        type: 'date',
        required: true,
      },
      {
        name: 'provider',
        type: 'text',
        required: true,
      },
      {
        name: 'source_product',
        type: 'text',
      },
      {
        name: 'radiance_mcd_m2',
        type: 'number',
      },
      {
        name: 'sqm_mag_arcsec2',
        type: 'number',
      },
      {
        name: 'bortle_class',
        type: 'number',
        required: true,
      },
      {
        name: 'confidence',
        type: 'select',
        required: true,
        maxSelect: 1,
        values: ['estimated', 'modelled', 'measured'],
      },
      {
        name: 'metadata_json',
        type: 'text',
      },
      {
        name: 'fetched_at',
        type: 'date',
        required: true,
      },
    ],
    indexes: [
      'CREATE INDEX idx_atlas_light_pollution_samples_lookup ON atlas_light_pollution_samples (latitude, longitude, sample_date)',
      'CREATE INDEX idx_atlas_light_pollution_samples_provider ON atlas_light_pollution_samples (provider, source_product)',
    ],
  })

  const cityStamps = new Collection({
    type: 'base',
    name: 'atlas_city_stamps',
    listRule: 'public = true || user = @request.auth.id',
    viewRule: 'public = true || user = @request.auth.id',
    createRule: 'user = @request.auth.id',
    updateRule: 'user = @request.auth.id',
    deleteRule: 'user = @request.auth.id',
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
        name: 'city_key',
        type: 'text',
        required: true,
      },
      {
        name: 'city_name',
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
        name: 'checkin_count',
        type: 'number',
        required: true,
      },
      {
        name: 'first_checked_in_at',
        type: 'date',
        required: true,
      },
      {
        name: 'last_checked_in_at',
        type: 'date',
        required: true,
      },
      {
        name: 'public',
        type: 'bool',
      },
      {
        name: 'share_slug',
        type: 'text',
      },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_atlas_city_stamps_user_city ON atlas_city_stamps (user, city_key)',
      'CREATE UNIQUE INDEX idx_atlas_city_stamps_share_slug ON atlas_city_stamps (share_slug)',
      'CREATE INDEX idx_atlas_city_stamps_public ON atlas_city_stamps (public, share_slug)',
    ],
  })

  app.save(lightPollutionSamples)
  app.save(cityStamps)
}, (app) => {
  for (const name of ['atlas_city_stamps', 'atlas_light_pollution_samples']) {
    try {
      app.delete(app.findCollectionByNameOrId(name))
    } catch {
      // Collection may already be absent when rolling back a partial migration.
    }
  }
})
