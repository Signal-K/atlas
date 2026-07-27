migrate((app) => {
  const observations = app.findCollectionByNameOrId('atlas_observations')
  observations.fields.add(
    new TextField({
      name: 'ai_caption',
      required: false,
      max: 600,
    }),
  )
  app.save(observations)
}, (app) => {
  const observations = app.findCollectionByNameOrId('atlas_observations')
  const field = observations.fields.getByName('ai_caption')
  if (field) observations.fields.removeById(field.id)
  app.save(observations)
})
