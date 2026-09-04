migrate((app) => {
  const users = app.findCollectionByNameOrId('users')

  // Mirrors atlas_city_stamps' shape deliberately (same checkin_count /
  // first+last timestamp / public+share_slug fields) so the badge share page
  // can reuse CityStampSharePage's pattern later instead of inventing a new
  // one. Tier (bronze/silver/gold) is derived from submission_count in code
  // (citizenScienceBadges.ts), not stored here -- same reasoning streaks.ts
  // keeps `currentWeeks` as the source of truth rather than a redundant label.
  const badges = new Collection({
    type: 'base',
    name: 'atlas_citizen_science_badges',
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
        name: 'project',
        type: 'text',
        required: true,
      },
      {
        name: 'submission_count',
        type: 'number',
        required: true,
      },
      {
        name: 'first_submitted_at',
        type: 'date',
        required: true,
      },
      {
        name: 'last_submitted_at',
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
      'CREATE UNIQUE INDEX idx_atlas_citizen_science_badges_user_project ON atlas_citizen_science_badges (user, project)',
      'CREATE UNIQUE INDEX idx_atlas_citizen_science_badges_share_slug ON atlas_citizen_science_badges (share_slug)',
      'CREATE INDEX idx_atlas_citizen_science_badges_public ON atlas_citizen_science_badges (public, share_slug)',
    ],
  })

  app.save(badges)
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId('atlas_citizen_science_badges'))
  } catch {
    // Collection may already be absent when rolling back a partial migration.
  }
})
