#!/usr/bin/env node
// Scheduled watchlist notification sweep (AT-011): for each user, match
// their watchlist (event type or target) against sky_events starting soon,
// gate on weather when the event has a location, and web-push everyone who
// hasn't already been notified for that event.
import PocketBase from 'pocketbase'
import webpush from 'web-push'

const PB_URL = process.env.PB_URL ?? 'http://127.0.0.1:8090'
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:liam@skinetics.tech'

// Notify for events starting within this window from now — short enough
// that "good viewing coming up" is still true by the time someone reads it,
// long enough that a daily cron catches everything before it happens.
const NOTIFY_WINDOW_HOURS = 48
const CLOUD_COVER_GOOD_THRESHOLD = 70

async function fetchCloudCoverPct(lat, lon, date) {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', lat)
  url.searchParams.set('longitude', lon)
  url.searchParams.set('daily', 'cloud_cover_mean')
  url.searchParams.set('start_date', date)
  url.searchParams.set('end_date', date)
  url.searchParams.set('timezone', 'auto')

  const response = await fetch(url)
  if (!response.ok) return null
  const data = await response.json()
  return data.daily?.cloud_cover_mean?.[0] ?? null
}

function matches(event, favourite) {
  if (favourite.kind === 'event_type') return favourite.value === event.kind
  if (favourite.kind === 'target') return favourite.value.toLowerCase() === event.target.toLowerCase()
  return false
}

async function main() {
  if (!PB_ADMIN_EMAIL || !PB_ADMIN_PASSWORD) {
    console.error('PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD env vars are required.')
    process.exit(1)
  }
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error('VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY env vars are required (npm run vapid).')
    process.exit(1)
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

  const pb = new PocketBase(PB_URL)
  await pb.collection('_superusers').authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD)

  const now = new Date()
  const windowEnd = new Date(now.getTime() + NOTIFY_WINDOW_HOURS * 60 * 60_000)
  const upcoming = await pb.collection('sky_events').getFullList({
    filter: `starts_at >= "${now.toISOString()}" && starts_at <= "${windowEnd.toISOString()}"`,
  })

  const watchlist = await pb.collection('atlas_watchlist').getFullList({ expand: 'favourite' })

  let notified = 0
  let skippedWeather = 0
  let skippedNoSubscription = 0

  for (const entry of watchlist) {
    const favourite = entry.expand?.favourite
    if (!favourite) continue

    const matchingEvents = upcoming.filter((event) => matches(event, favourite))
    for (const event of matchingEvents) {
      // Unique (user, event) index doubles as the dedup check: if this
      // insert fails, we've already notified this user for this event.
      try {
        await pb.collection('atlas_notifications_sent').create({ user: entry.user, event: event.id })
      } catch {
        continue
      }

      if (event.latitude != null && event.longitude != null) {
        const date = event.starts_at.slice(0, 10)
        const cloudCover = await fetchCloudCoverPct(event.latitude, event.longitude, date)
        if (cloudCover != null && cloudCover >= CLOUD_COVER_GOOD_THRESHOLD) {
          skippedWeather += 1
          continue
        }
      }

      const subscriptions = await pb.collection('atlas_push_subscriptions').getFullList({
        filter: `user = "${entry.user}"`,
      })
      if (subscriptions.length === 0) {
        skippedNoSubscription += 1
        continue
      }

      const payload = JSON.stringify({
        title: event.title,
        body: event.description || 'A good viewing opportunity is coming up.',
        url: '/',
      })

      for (const subscription of subscriptions) {
        try {
          await webpush.sendNotification(
            { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
            payload,
          )
          notified += 1
        } catch (error) {
          if (error.statusCode === 404 || error.statusCode === 410) {
            await pb.collection('atlas_push_subscriptions').delete(subscription.id)
          } else {
            console.error(`Push failed for subscription ${subscription.id}:`, error.message)
          }
        }
      }
    }
  }

  console.log(
    `Notify complete: ${notified} pushes sent, ${skippedWeather} skipped for weather, ${skippedNoSubscription} skipped with no subscription.`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
