// Ask Atlas was removed permanently; drop its guest-question counter table.
migrate((app) => {
  try {
    app.delete(app.findCollectionByNameOrId('atlas_guest_questions'))
  } catch {
    // Already absent.
  }
}, (app) => {
  // Not restored: the feature no longer exists.
})
