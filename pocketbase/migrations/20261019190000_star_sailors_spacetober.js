// Shared with Landnam (SSL-578). Field names match
// Signal-K/planet-hunters-experiment-1
// pocketbase/pb_migrations/1780713200_event_badges.js exactly.
// If that migration already created the collections, this one leaves them.
//
// event_badges
//   user, event_id, tier (gold|silver), source, earned_at (unix ms),
//   subject_id, marker, voucher
//   Unique (user, event_id, subject_id).
//   Atlas writes source "atlas".
//   Joint check-in: event_id "orionids-2026", subject_id "check-in",
//   marker "after-moonset". Landnam planet finds use marker "orionids-found"
//   and voucher "owned"; Atlas does not write those.
//
// meteorite_mastery — one row per user
//   user, level, source, event_id, earned_at (unix ms)
//   Unique (user). Atlas sets level to at least 1 and does not lower it.
//   A row Landnam already wrote (source "landnam", level >= 1) is left as-is.
migrate((app) => {
  let users
  try {
    users = app.findCollectionByNameOrId('users')
  } catch {
    return
  }
  const owner = 'user = @request.auth.id'
  const create = '@request.auth.id != "" && user = @request.auth.id'

  try {
    app.findCollectionByNameOrId('event_badges')
  } catch {
    app.save(new Collection({
      type: 'base',
      name: 'event_badges',
      listRule: owner,
      viewRule: owner,
      createRule: create,
      updateRule: owner,
      deleteRule: owner,
      fields: [
        { type: 'relation', name: 'user', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
        { type: 'text', name: 'event_id', required: true, max: 80 },
        { type: 'select', name: 'tier', required: true, maxSelect: 1, values: ['gold', 'silver'] },
        { type: 'text', name: 'source', required: true, max: 40 },
        { type: 'number', name: 'earned_at', required: true },
        { type: 'text', name: 'subject_id', required: true, max: 120 },
        { type: 'text', name: 'marker', max: 40 },
        { type: 'text', name: 'voucher', max: 20 },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_event_badges_user_event_subject ON event_badges (user, event_id, subject_id)',
      ],
    }))
  }

  try {
    app.findCollectionByNameOrId('meteorite_mastery')
  } catch {
    app.save(new Collection({
      type: 'base',
      name: 'meteorite_mastery',
      listRule: owner,
      viewRule: owner,
      createRule: create,
      updateRule: owner,
      deleteRule: owner,
      fields: [
        { type: 'relation', name: 'user', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
        { type: 'number', name: 'level', required: true },
        { type: 'text', name: 'source', required: true, max: 40 },
        { type: 'text', name: 'event_id', required: true, max: 80 },
        { type: 'number', name: 'earned_at', required: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_meteorite_mastery_user ON meteorite_mastery (user)',
      ],
    }))
  }
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId('meteorite_mastery')) } catch { /* already absent */ }
  try { app.delete(app.findCollectionByNameOrId('event_badges')) } catch { /* already absent */ }
})
