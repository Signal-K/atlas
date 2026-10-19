// Server-side counter for logged-out Ask Atlas questions. The hook is the
// only writer; API rules stay closed so a client cannot reset its own quota.
migrate((app) => {
  const questions = new Collection({
    type: 'base',
    name: 'atlas_guest_questions',
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        name: 'ip_hash',
        type: 'text',
        required: true,
      },
      {
        name: 'day',
        type: 'text',
        required: true,
      },
      {
        name: 'count',
        type: 'number',
        required: true,
      },
      {
        name: 'last_at',
        type: 'text',
        required: false,
      },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_atlas_guest_questions_ip_day ON atlas_guest_questions (ip_hash, day)',
    ],
  })

  app.save(questions)
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId('atlas_guest_questions'))
  } catch {
    // Collection may already be absent when rolling back a partial migration.
  }
})
