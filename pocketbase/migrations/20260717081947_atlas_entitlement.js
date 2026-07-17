migrate((app) => {
  const users = app.findCollectionByNameOrId('users')
  users.fields.add(
    new BoolField({
      name: 'entitled',
      required: false,
    }),
  )
  app.save(users)
}, (app) => {
  const users = app.findCollectionByNameOrId('users')
  const field = users.fields.getByName('entitled')
  if (field) users.fields.removeById(field.id)
  app.save(users)
})
