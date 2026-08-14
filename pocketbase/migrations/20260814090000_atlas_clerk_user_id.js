// Mirrors backend/migrations/26_clerk_identity_mapping.go (the Go backend's
// schema) -- this JS-hooks PocketBase instance is CI-only (see the "Atlas
// pb_hooks are CI-only, not prod" project note), but the write-action e2e
// spec drives a real Clerk sign-up through this same instance and needs the
// same `clerk_user_id` column the exchange handler writes to.
migrate((app) => {
  const users = app.findCollectionByNameOrId('users')
  if (!users.fields.getByName('clerk_user_id')) {
    users.fields.add(new TextField({ name: 'clerk_user_id' }))
  }

  const index = 'CREATE UNIQUE INDEX idx_users_clerk_user_id ON users (clerk_user_id) WHERE clerk_user_id != \'\''
  if (!users.indexes.includes(index)) {
    users.indexes.push(index)
  }
  app.save(users)
}, (app) => {
  const users = app.findCollectionByNameOrId('users')
  const field = users.fields.getByName('clerk_user_id')
  if (field) users.fields.removeById(field.id)
  users.indexes = users.indexes.filter(
    (index) => index !== 'CREATE UNIQUE INDEX idx_users_clerk_user_id ON users (clerk_user_id) WHERE clerk_user_id != \'\'',
  )
  app.save(users)
})
