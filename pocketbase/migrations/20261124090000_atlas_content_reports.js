// User reports of content or Ask Atlas answers (App Store guideline 1.2).
// Signed-in users can file a report; only admins can read or change them.
migrate((app) => {
  const reports = new Collection({
    type: 'base',
    name: 'atlas_content_reports',
    listRule: null,
    viewRule: null,
    createRule: '@request.auth.id != "" && @request.body.reporter = @request.auth.id',
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: 'reporter', type: 'relation', required: true, collectionId: app.findCollectionByNameOrId('users').id, maxSelect: 1, cascadeDelete: true },
      { name: 'kind', type: 'select', required: true, maxSelect: 1, values: ['ask_answer', 'submission', 'check_in', 'user', 'other'] },
      { name: 'reason', type: 'select', required: true, maxSelect: 1, values: ['inaccurate', 'harmful', 'offensive', 'spam', 'other'] },
      { name: 'target', type: 'text', required: false, max: 200 },
      { name: 'excerpt', type: 'text', required: false, max: 2000 },
      { name: 'details', type: 'text', required: false, max: 1000 },
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    ],
  })
  app.save(reports)
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId('atlas_content_reports'))
  } catch {
    // Already absent.
  }
})
