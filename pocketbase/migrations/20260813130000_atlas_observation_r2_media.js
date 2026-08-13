migrate((app) => {
  const observations = app.findCollectionByNameOrId('atlas_observations')
  observations.fields.add(new TextField({ name: 'photo_r2_key', required: false, max: 255 }))
  observations.fields.add(new NumberField({ name: 'photo_r2_size', required: false, min: 0 }))
  app.save(observations)
}, (app) => {
  const observations = app.findCollectionByNameOrId('atlas_observations')
  for (const name of ['photo_r2_key', 'photo_r2_size']) {
    const field = observations.fields.getByName(name)
    if (field) observations.fields.removeById(field.id)
  }
  app.save(observations)
})
