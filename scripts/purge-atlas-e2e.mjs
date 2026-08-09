import PocketBase from 'pocketbase'

const baseUrl = process.env.ATLAS_E2E_PB_URL ?? process.env.VITE_PB_URL
const adminEmail = process.env.ATLAS_E2E_ADMIN_EMAIL
const adminPassword = process.env.ATLAS_E2E_ADMIN_PASSWORD
const suffix = '@atlas-e2e.test'

if (!baseUrl || !adminEmail || !adminPassword) {
  throw new Error('ATLAS_E2E_PB_URL, ATLAS_E2E_ADMIN_EMAIL, and ATLAS_E2E_ADMIN_PASSWORD are required')
}

const pb = new PocketBase(baseUrl)
await pb.admins.authWithPassword(adminEmail, adminPassword)
const users = await pb.collection('users').getFullList({ filter: `email ~ "${suffix}"` })

// These are every known user-owned collection in the shared backend. Missing
// optional collections are ignored so this remains usable across migration
// versions. Nothing is deleted by a broad table wipe or by an unscoped filter.
const ownedCollections = [
  ...[
    'ecosystem_profiles',
    'leaderboard_stats',
    'classifications',
    'subject_classifications',
    'asteroid_classifications',
    'atlas_favourites',
    'atlas_watchlist',
    'atlas_observations',
    'atlas_streaks',
    'atlas_discoveries',
    'atlas_discovery_votes',
    'atlas_discovery_comments',
    'atlas_discovery_reactions',
    'atlas_push_subscriptions',
    'atlas_notifications_sent',
    'atlas_streak_leaderboard_entries',
    'atlas_photo_challenge_submissions',
    'atlas_camera_presets',
    'atlas_city_stamps',
    'atlas_get_ready_reminders',
    'atlas_demo_access_redemptions',
    'ss_user_identity',
  ].map((name) => ({ name, ownerField: 'user' })),
  { name: 'comments', ownerField: 'author' },
]

let deletedRecords = 0
for (const user of users) {
  for (const { name, ownerField } of ownedCollections) {
    let records
    try {
      records = await pb.collection(name).getFullList({ filter: `${ownerField} = "${user.id}"` })
    } catch (error) {
      if (error?.status === 404) continue
      throw error
    }
    for (const record of records) {
      await pb.collection(name).delete(record.id)
      deletedRecords += 1
    }
  }

  // Test-created fixture events are namespaced too. They are not shared seed
  // data and are removed alongside the test account.
  try {
    const events = await pb.collection('sky_events').getFullList({ filter: `target ~ "atlas-e2e:"` })
    for (const event of events) {
      await pb.collection('sky_events').delete(event.id)
      deletedRecords += 1
    }
  } catch (error) {
    if (error?.status !== 404) throw error
  }

  await pb.collection('users').delete(user.id)
  deletedRecords += 1
}

const remaining = await pb.collection('users').getFullList({ filter: `email ~ "${suffix}"` })
if (remaining.length > 0) throw new Error(`purge left ${remaining.length} Atlas E2E account(s)`)
console.log(`Purged ${users.length} Atlas E2E account(s) and ${deletedRecords} owned record(s) from ${baseUrl}`)
