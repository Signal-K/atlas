migrate((app) => {
  const users = app.findCollectionByNameOrId('users')
  if (!users.fields.getByName('first_tour_completed_at')) {
    users.fields.add(new TextField({ name: 'first_tour_completed_at', max: 40 }))
  }
  if (!users.fields.getByName('first_tour_badge')) {
    users.fields.add(new SelectField({ name: 'first_tour_badge', maxSelect: 1, values: ['first_light'] }))
  }
  app.save(users)
}, (app) => {
  const users = app.findCollectionByNameOrId('users')
  for (const name of ['first_tour_completed_at', 'first_tour_badge']) {
    const field = users.fields.getByName(name)
    if (field) users.fields.removeById(field.id)
  }
  app.save(users)
})
