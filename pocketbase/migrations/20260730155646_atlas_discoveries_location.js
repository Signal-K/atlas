migrate((app) => {
  const discoveries = app.findCollectionByNameOrId('atlas_discoveries')

  discoveries.fields.add(
    new NumberField({
      name: 'latitude',
    }),
  )
  discoveries.fields.add(
    new NumberField({
      name: 'longitude',
    }),
  )

  app.save(discoveries)
}, (app) => {
  const discoveries = app.findCollectionByNameOrId('atlas_discoveries')

  for (const name of ['latitude', 'longitude']) {
    const field = discoveries.fields.getByName(name)
    if (field) discoveries.fields.removeById(field.id)
  }

  app.save(discoveries)
})
