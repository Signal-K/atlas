migrate((app) => {
  const users = app.findCollectionByNameOrId('users')
  users.fields.add(
    new BoolField({
      name: 'onboarded',
      required: false,
    }),
  )
  app.save(users)
}, (app) => {
  const users = app.findCollectionByNameOrId('users')
  const field = users.fields.getByName('onboarded')
  if (field) users.fields.removeById(field.id)
  app.save(users)
})
