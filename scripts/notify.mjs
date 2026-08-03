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
const POSTHOG_KEY = process.env.POSTHOG_KEY
const POSTHOG_HOST = process.env.POSTHOG_HOST ?? 'https://us.i.posthog.com'

// Notify for events starting within this window from now — short enough
// that "good viewing coming up" is still true by the time someone reads it,
// long enough that a daily cron catches everything before it happens.
const NOTIFY_WINDOW_HOURS = 48
const CLOUD_COVER_GOOD_THRESHOLD = 70
const GET_READY_LOOKAHEAD_MINUTES = 10

// Best-effort server-side capture: this cron sweep is the only place that
// knows *why* a push was skipped (weather gate, no subscription), which the
// client-side event stream never sees. A PostHog outage must never fail a
// notification send, so this only logs and swallows.
async function captureServerEvent(distinctId, event, properties) {
  if (!POSTHOG_KEY || !distinctId) return
  try {
    await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: POSTHOG_KEY,
        event,
        distinct_id: distinctId,
        properties: { ...properties, source: 'notify_cron' },
      }),
    })
  } catch (error) {
    console.error(`PostHog capture failed for "${event}":`, error.message)
  }
}

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

function reminderWindowDuration(reminder) {
  const start = new Date(reminder.starts_at).getTime()
  const end = new Date(reminder.ends_at || reminder.starts_at).getTime()
  const minutes = Math.max(5, Math.round((end - start) / 60_000))
  if (minutes >= 90) return `about ${Math.round(minutes / 60)} hours`
  return `about ${minutes} minutes`
}

function conditionCopy(cloudCoverPct, precipitationChancePct) {
  if (cloudCoverPct == null) return 'sky check unavailable'
  const sky = cloudCoverPct < 30 ? 'clear sky' : cloudCoverPct < 70 ? 'partly cloudy sky' : 'cloudy sky'
  if (precipitationChancePct != null && precipitationChancePct >= 20) return `${sky}, ${Math.round(precipitationChancePct)}% rain chance`
  return `${sky}, ${Math.round(cloudCoverPct)}% cloud`
}

function reminderNotificationBody(reminder, condition) {
  const direction = reminder.direction_label ? ` Look ${reminder.direction_label}.` : ''
  return `${reminder.title} is visible now for ${reminderWindowDuration(reminder)}. ${conditionCopy(
    condition.cloudCoverPct ?? reminder.cloud_cover_pct,
    condition.precipitationChancePct ?? reminder.precipitation_chance_pct,
  )}.${direction} Set up ${reminder.device_name}.`
}

function matches(event, favourite) {
  if (favourite.kind === 'event_type') return favourite.value === event.kind
  if (favourite.kind === 'target') return favourite.value.toLowerCase() === event.target.toLowerCase()
  return false
}

async function currentConditionForReminder(reminder) {
  let cloudCoverPct = reminder.cloud_cover_pct
  let precipitationChancePct = reminder.precipitation_chance_pct

  if (reminder.latitude != null && reminder.longitude != null) {
    const date = reminder.starts_at.slice(0, 10)
    const cloudCover = await fetchCloudCoverPct(reminder.latitude, reminder.longitude, date)
    if (cloudCover != null) cloudCoverPct = cloudCover
  }

  if (cloudCoverPct != null && cloudCoverPct >= 75) return { acceptable: false, reason: 'clouded_out', cloudCoverPct, precipitationChancePct }
  if (precipitationChancePct != null && precipitationChancePct >= 50) {
    return { acceptable: false, reason: 'rain_risk', cloudCoverPct, precipitationChancePct }
  }
  return { acceptable: true, cloudCoverPct, precipitationChancePct }
}

async function subscriptionsForUser(pb, user) {
  return pb.collection('atlas_push_subscriptions').getFullList({ filter: `user = "${user}"` })
}

async function sendPayloadToSubscriptions(pb, subscriptions, payload) {
  let sent = 0
  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        payload,
      )
      sent += 1
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await pb.collection('atlas_push_subscriptions').delete(subscription.id)
      } else {
        throw error
      }
    }
  }
  return sent
}

async function sendGetReadyReminders(pb, now) {
  const dueEnd = new Date(now.getTime() + GET_READY_LOOKAHEAD_MINUTES * 60_000)
  const reminders = await pb.collection('atlas_get_ready_reminders').getFullList({
    filter: `remind_at <= "${dueEnd.toISOString()}" && fired_at = "" && skipped_reason = ""`,
  })

  let sent = 0
  let skippedWeather = 0
  let skippedNoSubscription = 0
  let failed = 0

  for (const reminder of reminders) {
    const condition = await currentConditionForReminder(reminder)
    if (!condition.acceptable) {
      await pb.collection('atlas_get_ready_reminders').update(reminder.id, {
        skipped_reason: condition.reason,
        last_error: '',
      })
      skippedWeather += 1
      await captureServerEvent(reminder.user, 'Reminder push skipped (server)', {
        reminderId: reminder.id,
        reason: condition.reason,
      })
      continue
    }

    const subscriptions = await subscriptionsForUser(pb, reminder.user)
    if (subscriptions.length === 0) {
      await pb.collection('atlas_get_ready_reminders').update(reminder.id, { last_error: 'no_push_subscription' })
      skippedNoSubscription += 1
      await captureServerEvent(reminder.user, 'Reminder push skipped (server)', {
        reminderId: reminder.id,
        reason: 'no_push_subscription',
      })
      continue
    }

    const payload = JSON.stringify({
      title: 'Atlas: get ready',
      body: reminderNotificationBody(reminder, condition),
      url: '/plan',
    })

    try {
      const sentForReminder = await sendPayloadToSubscriptions(pb, subscriptions, payload)
      if (sentForReminder > 0) {
        await pb.collection('atlas_get_ready_reminders').update(reminder.id, {
          fired_at: new Date().toISOString(),
          skipped_reason: '',
          last_error: '',
        })
        sent += sentForReminder
        await captureServerEvent(reminder.user, 'Reminder push delivered (server)', {
          reminderId: reminder.id,
          subscriptionCount: sentForReminder,
        })
      } else {
        await pb.collection('atlas_get_ready_reminders').update(reminder.id, { last_error: 'no_active_push_subscription' })
        skippedNoSubscription += 1
        await captureServerEvent(reminder.user, 'Reminder push skipped (server)', {
          reminderId: reminder.id,
          reason: 'no_active_push_subscription',
        })
      }
    } catch (error) {
      await pb.collection('atlas_get_ready_reminders').update(reminder.id, { last_error: error.message ?? 'push_failed' })
      failed += 1
      await captureServerEvent(reminder.user, 'Reminder push skipped (server)', {
        reminderId: reminder.id,
        reason: 'push_failed',
      })
    }
  }

  return { sent, skippedWeather, skippedNoSubscription, failed }
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
          await captureServerEvent(entry.user, 'Reminder push skipped (server)', {
            eventId: event.id,
            reason: 'weather',
          })
          continue
        }
      }

      const subscriptions = await subscriptionsForUser(pb, entry.user)
      if (subscriptions.length === 0) {
        skippedNoSubscription += 1
        await captureServerEvent(entry.user, 'Reminder push skipped (server)', {
          eventId: event.id,
          reason: 'no_push_subscription',
        })
        continue
      }

      const payload = JSON.stringify({
        title: event.title,
        body: event.description || 'A good viewing opportunity is coming up.',
        url: '/',
      })

      let sentForEvent = 0
      for (const subscription of subscriptions) {
        try {
          await webpush.sendNotification(
            { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
            payload,
          )
          notified += 1
          sentForEvent += 1
        } catch (error) {
          if (error.statusCode === 404 || error.statusCode === 410) {
            await pb.collection('atlas_push_subscriptions').delete(subscription.id)
          } else {
            console.error(`Push failed for subscription ${subscription.id}:`, error.message)
          }
        }
      }

      if (sentForEvent > 0) {
        await captureServerEvent(entry.user, 'Reminder push delivered (server)', {
          eventId: event.id,
          subscriptionCount: sentForEvent,
        })
      }
    }
  }

  const getReady = await sendGetReadyReminders(pb, now)

  console.log(
    `Notify complete: ${notified} watchlist pushes sent, ${skippedWeather} watchlist skipped for weather, ${skippedNoSubscription} watchlist skipped with no subscription. Get-ready: ${getReady.sent} pushes sent, ${getReady.skippedWeather} skipped for weather, ${getReady.skippedNoSubscription} skipped with no subscription, ${getReady.failed} failed.`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
