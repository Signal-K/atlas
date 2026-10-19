migrate((app) => {
  const observations = app.findCollectionByNameOrId('atlas_observations')
  // Project-agnostic tag (e.g. 'globe_at_night') rather than a boolean, so a
  // future second citizen-science project (AAVSO, etc.) reuses these same
  // columns instead of needing another migration per project.
  observations.fields.add(new TextField({ name: 'citizen_science_project', required: false, max: 100 }))
  // Populated asynchronously by the extension-side processor (atlas-extensions
  // skybrightness service) once it has plate-solved the submitted photo --
  // absent/null until then, not required at submission time.
  observations.fields.add(new NumberField({ name: 'sky_brightness_limiting_magnitude', required: false }))
  observations.fields.add(
    new SelectField({
      name: 'sky_brightness_confidence',
      required: false,
      maxSelect: 1,
      // Same three-tier vocabulary as atlas_light_pollution_samples.confidence
      // -- one shared meaning for "how trustworthy is this brightness number"
      // across externally-fetched samples and user-submitted ones.
      values: ['estimated', 'modelled', 'measured'],
    }),
  )
  observations.fields.add(new NumberField({ name: 'sky_brightness_bortle_estimate', required: false, min: 1, max: 9 }))
  observations.fields.add(new NumberField({ name: 'sky_brightness_stars_detected', required: false, min: 0 }))
  // Processed-JPEG photometry is not physically calibrated the way RAW is
  // (phone "night mode" denoise/stacking breaks the linear photon-count
  // relationship) -- the processor records what it actually got so low
  // confidence can be explained rather than silently guessed at.
  observations.fields.add(
    new SelectField({
      name: 'sky_brightness_source_format',
      required: false,
      maxSelect: 1,
      values: ['raw', 'jpeg', 'unknown'],
    }),
  )
  // Set when the processor's estimate is physically implausible for the
  // submission's location/device (eBird-style automated-flag-then-review
  // safety net) -- surfaced for moderation, never silently discarded.
  observations.fields.add(new BoolField({ name: 'sky_brightness_flagged_for_review', required: false }))
  app.save(observations)
}, (app) => {
  const observations = app.findCollectionByNameOrId('atlas_observations')
  for (const name of [
    'citizen_science_project',
    'sky_brightness_limiting_magnitude',
    'sky_brightness_confidence',
    'sky_brightness_bortle_estimate',
    'sky_brightness_stars_detected',
    'sky_brightness_source_format',
    'sky_brightness_flagged_for_review',
  ]) {
    const field = observations.fields.getByName(name)
    if (field) observations.fields.removeById(field.id)
  }
  app.save(observations)
})
