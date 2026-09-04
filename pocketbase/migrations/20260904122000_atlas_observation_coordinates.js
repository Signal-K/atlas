migrate((app) => {
  const observations = app.findCollectionByNameOrId('atlas_observations')
  // location_label is a free-text city name (see 'Your recent frames' /
  // cityStamps.ts) -- not enough for the skybrightness processor's
  // plate-solve, which needs real coordinates to constrain its search. Only
  // populated when the capture flow already has a coordinate on hand (e.g.
  // a citizen-science campaign submission); an ordinary Journal entry can
  // leave these unset exactly as it does today.
  observations.fields.add(new NumberField({ name: 'latitude', required: false, min: -90, max: 90 }))
  observations.fields.add(new NumberField({ name: 'longitude', required: false, min: -180, max: 180 }))
  app.save(observations)
}, (app) => {
  const observations = app.findCollectionByNameOrId('atlas_observations')
  for (const name of ['latitude', 'longitude']) {
    const field = observations.fields.getByName(name)
    if (field) observations.fields.removeById(field.id)
  }
  app.save(observations)
})
