#!/usr/bin/env node
// Scheduled review digest for backdated check-ins (KES-446): when a photo's
// EXIF could not place a past night, the user describes it themselves and the
// entry waits on a human before it counts toward a city stamp. Like
// `moderate-photo-challenges.mjs`, this script only *surfaces* what's pending
// so an admin can approve or reject it in the PocketBase admin UI -- it never
// mutates a row. Invoked by GitHub Actions on a schedule or manually:
// `node scripts/review-checkin-queue.mjs` (or `npm run review:checkins`).
//
// The value this adds over the admin UI is **age**. A backlog of non-urgent
// submissions is invisible in a filtered collection list, and a submission
// that has waited three weeks is the one that actually needs a decision.

import PocketBase from 'pocketbase'

const PB_URL = process.env.PB_URL ?? 'http://127.0.0.1:8090'
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD

const COLLECTION = 'atlas_checkin_review_queue'
const NOTE_LIMIT = 160

function daysSince(iso) {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return null
  return Math.floor((Date.now() - then) / 86_400_000)
}

function truncate(text, limit = NOTE_LIMIT) {
  const trimmed = String(text ?? '').trim().replace(/\s+/g, ' ')
  if (!trimmed) return '(none)'
  return trimmed.length > limit ? `${trimmed.slice(0, limit - 1)}…` : trimmed
}

/** The generated event as the client saw it, or a label saying there wasn't one. */
function describeEvent(row) {
  const snapshot = row.event_snapshot
  if (!snapshot || typeof snapshot !== 'object') return 'no event matched'
  const title = snapshot.title ?? snapshot.target ?? snapshot.kind
  if (!title) return 'no event matched'
  const startsAt = snapshot.starts_at ? ` (${snapshot.starts_at})` : ''
  return `${title}${startsAt}`
}

function describePlace(row) {
  const label = row.location_label ?? '(no location)'
  // 0/0 is the collection's "unset" convention, matching the NumberField-has-no-
  // null rule documented in eventFilters.ts -- printing "0.00, 0.00" would read
  // as a real coordinate off the coast of Africa.
  const hasCoords = (row.latitude || row.longitude) && !(row.latitude === 0 && row.longitude === 0)
  return hasCoords ? `${label} — ${Number(row.latitude).toFixed(3)}, ${Number(row.longitude).toFixed(3)}` : label
}

async function main() {
  const pb = new PocketBase(PB_URL)
  await pb.collection('_superusers').authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD)

  const pending = await pb.collection(COLLECTION).getFullList({
    filter: 'status = "pending"',
    sort: 'created',
    expand: 'user',
  })

  if (pending.length === 0) {
    console.log('No backdated check-ins pending review.')
    return
  }

  // Oldest first (the query sorts ascending by `created`), because the ageing
  // end of the queue is the whole reason this runs on a schedule.
  const oldest = daysSince(pending[0].created)
  console.log(
    `${pending.length} backdated check-in(s) pending review` +
      (oldest != null ? ` — oldest ${oldest} day(s) old.\n` : '.\n'),
  )

  for (const row of pending) {
    const age = daysSince(row.created)
    const email = row.expand?.user?.email ?? row.user
    const day = row.day_key ?? '(no day)'
    const flags = [row.day_ambiguous ? 'date was ambiguous' : null, row.photo_r2_key ? 'has photo' : 'no photo']
      .filter(Boolean)
      .join(', ')

    console.log(`- ${day}${age != null ? ` (${age}d)` : ''} — ${email}`)
    console.log(`  Place:   ${describePlace(row)} [${row.anchor_source ?? 'manual'}]`)
    console.log(`  Matched: ${describeEvent(row)} (${row.match_confidence ?? 'none'}, ${row.matched_by ?? 'manual'})`)
    console.log(`  Flags:   ${flags || 'none'}`)
    console.log(`  Note:    ${truncate(row.note)}`)
    console.log(`  Review:  ${PB_URL}/_/#/collections/${COLLECTION}/${row.id}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
