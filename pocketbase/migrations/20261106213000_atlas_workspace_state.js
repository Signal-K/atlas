migrate((app) => {
  try { app.findCollectionByNameOrId('atlas_workspace_state'); return } catch { /* create when absent */ }
  const users = app.findCollectionByNameOrId('users')
  const owner = '@request.auth.id != "" && user = @request.auth.id'
  const collection = new Collection({
    name: 'atlas_workspace_state', type: 'base',
    listRule: owner, viewRule: owner, createRule: owner,
    updateRule: owner + ' && (@request.body.user:isset = false || @request.body.user = @request.auth.id)',
    deleteRule: owner,
    fields: [
      { name: 'user', type: 'relation', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
      { name: 'key', type: 'text', required: true, max: 120 },
      { name: 'value', type: 'json', maxSize: 65536 },
      { name: 'client_updated_at', type: 'text', required: true, max: 32 },
    ],
    indexes: ['CREATE UNIQUE INDEX idx_atlas_workspace_user_key ON atlas_workspace_state (user, key)'],
  })
  app.save(collection)
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId('atlas_workspace_state')) } catch { /* already absent */ }
})
