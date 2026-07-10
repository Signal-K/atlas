#!/usr/bin/env node
// Scheduled moderation scan (b0wx8o): photo challenge submissions are
// shadowbanned by default (visible only to their author) until a superuser
// approves them. There is no auto-approval heuristic here -- this script
// only *surfaces* what's pending so an admin can approve via the PocketBase
// admin UI; it does not flip `approved` itself. Invoked by GitHub Actions on
// a schedule or manually: `node scripts/moderate-photo-challenges.mjs`.

import PocketBase from 'pocketbase'

const PB_URL = process.env.PB_URL ?? 'http://127.0.0.1:8090'
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD

async function main() {
  const pb = new PocketBase(PB_URL)
  await pb.collection('_superusers').authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD)

  const pending = await pb.collection('atlas_photo_challenge_submissions').getFullList({
    filter: 'approved = false',
    sort: 'created',
    expand: 'user,event',
  })

  if (pending.length === 0) {
    console.log('No photo challenge submissions pending approval.')
    return
  }

  console.log(`${pending.length} photo challenge submission(s) pending approval:\n`)
  for (const submission of pending) {
    const author = submission.expand?.user?.email ?? submission.user
    const eventTitle = submission.expand?.event?.title ?? submission.event
    const adminUrl = `${PB_URL}/_/#/collections/atlas_photo_challenge_submissions/${submission.id}`
    console.log(`- ${submission.challenge_id} (${eventTitle}) by ${author} — submitted ${submission.created}`)
    console.log(`  Review: ${adminUrl}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
