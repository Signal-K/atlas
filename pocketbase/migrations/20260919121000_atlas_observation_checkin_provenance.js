// CI mirror of backend/migrations/41_atlas_observation_checkin_provenance.go,
// which is the real production migration. Registered in
// backend/atlas-migrations-manifest.json as "ported" so
// scripts/sync-atlas-migrations.py does NOT stage this into
// backend/pb_migrations/. Keep the two files in step.
//
// Six fields that let a past check-in be told apart from an ordinary one after
// a round trip, and that let the diary and a reviewer show *why* a place and a
// day were claimed. They mirror the same optional properties on
// ObservationLogEntry in src/lib/db.ts, which needed no Dexie version bump.
//
// Each add is guarded, and the down function looks the field up by name rather
// than assuming an id -- same shape as the clerk_user_id migration.
migrate((app) => {
  const observations = app.findCollectionByNameOrId('atlas_observations')

  if (!observations.fields.getByName('check_in_kind')) {
    observations.fields.add(new SelectField({ name: 'check_in_kind', maxSelect: 1, values: ['tonight', 'past'] }))
  }
  if (!observations.fields.getByName('matched_by')) {
    observations.fields.add(new SelectField({ name: 'matched_by', maxSelect: 1, values: ['photo-exif', 'photo-exif-heading', 'manual'] }))
  }
  if (!observations.fields.getByName('match_confidence')) {
    observations.fields.add(new SelectField({ name: 'match_confidence', maxSelect: 1, values: ['strong', 'possible', 'weak', 'none'] }))
  }
  if (!observations.fields.getByName('anchor_source')) {
    observations.fields.add(new SelectField({
      name: 'anchor_source',
      maxSelect: 1,
      values: ['trip', 'trip-plan', 'journal-location', 'current-location', 'manual'],
    }))
  }
  // How the place was established when there was no photo GPS to read it from.
  // Kept on the entry because re-deriving it later would read today's trips,
  // not the ones that applied on that date.
  if (!observations.fields.getByName('anchor_label')) {
    observations.fields.add(new TextField({ name: 'anchor_label', max: 255 }))
  }
  if (!observations.fields.getByName('photo_day_ambiguous')) {
    observations.fields.add(new BoolField({ name: 'photo_day_ambiguous' }))
  }

  app.save(observations)
}, (app) => {
  const observations = app.findCollectionByNameOrId('atlas_observations')
  for (const name of [
    'check_in_kind',
    'matched_by',
    'match_confidence',
    'anchor_source',
    'anchor_label',
    'photo_day_ambiguous',
  ]) {
    const field = observations.fields.getByName(name)
    if (field) observations.fields.removeById(field.id)
  }
  app.save(observations)
})
