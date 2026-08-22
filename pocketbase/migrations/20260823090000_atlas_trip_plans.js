migrate((app) => {
  const users = app.findCollectionByNameOrId('users')

  const rule = 'user = @request.auth.id'
  const tripPlans = new Collection({
    type: 'base',
    name: 'atlas_trip_plans',
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
        name: 'start_date',
        type: 'date',
        required: true,
      },
      {
        name: 'end_date',
        type: 'date',
        required: true,
      },
      // Each is `{ cityKey, cityName, lat, lon, timeZone, startDate, endDate }` --
      // kept as one JSON blob rather than a child collection since a trip's
      // legs are always read/written together with the trip itself and are
      // capped to a handful of cities (see TRIP_MAX_LEGS client-side).
      {
        name: 'legs_json',
        type: 'text',
        required: true,
      },
      // Selected equipment ids, e.g. ["naked_eye", "binoculars", "iphone-17-pro"].
      {
        name: 'equipment_json',
        type: 'text',
        required: true,
      },
      // Selected interest ids -- EVENT_CATEGORIES ids from src/lib/eventCategories.ts.
      {
        name: 'interests_json',
        type: 'text',
        required: true,
      },
      // AI-generated per-leg guide, cached so it is not regenerated on every
      // view. Keyed by cityKey; null/absent until first generated.
      {
        name: 'guide_json',
        type: 'text',
      },
      {
        name: 'guide_generated_at',
        type: 'date',
      },
    ],
    indexes: [
      // One trip at a time: creating a second trip updates this row instead
      // of inserting a second one.
      'CREATE UNIQUE INDEX idx_atlas_trip_plans_user ON atlas_trip_plans (user)',
    ],
  })

  app.save(tripPlans)
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId('atlas_trip_plans'))
  } catch {
    // Collection may already be absent when rolling back a partial migration.
  }
})
