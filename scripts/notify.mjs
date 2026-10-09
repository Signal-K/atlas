#!/usr/bin/env node
// Scheduled watchlist notification sweep (AT-011): for each user, match
// their watchlist (event type or target) against sky_events starting soon,
// gate on weather when the event has a location, and web-push everyone who
// hasn't already been notified for that event.
import PocketBase from 'pocketbase'
import webpush from 'web-push'
import { connect as connectHttp2 } from 'node:http2'
import { createPrivateKey, createSign } from 'node:crypto'

const PB_URL = process.env.PB_URL ?? 'http://127.0.0.1:8090'
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:liam@skinetics.tech'
const POSTHOG_KEY = process.env.POSTHOG_KEY
const POSTHOG_HOST = process.env.POSTHOG_HOST ?? 'https://us.i.posthog.com'
const APNS_TEAM_ID = process.env.APNS_TEAM_ID
const APNS_KEY_ID = process.env.APNS_KEY_ID
const APNS_BUNDLE_ID = process.env.APNS_BUNDLE_ID
const APNS_PRIVATE_KEY = process.env.APNS_PRIVATE_KEY
const APNS_USE_SANDBOX = process.env.APNS_USE_SANDBOX === 'true'

// Notify for events starting within this window from now — short enough
// that "good viewing coming up" is still true by the time someone reads it,
// long enough that a daily cron catches everything before it happens.
const NOTIFY_WINDOW_HOURS = 48
const CLOUD_COVER_GOOD_THRESHOLD = 70
const GET_READY_LOOKAHEAD_MINUTES = 10
const APNS_JWT_TTL_SECONDS = 50 * 60

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

function normalizePrivateKey(raw) {
  if (!raw) return null
  if (raw.includes('-----BEGIN PRIVATE KEY-----')) return raw.replace(/\\n/g, '\n')
  const pem = Buffer.from(raw, 'base64').toString('utf8')
  return pem.includes('-----BEGIN PRIVATE KEY-----') ? pem : null
}

function buildApnsJwt(teamId, keyId, privateKeyPem) {
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) })).toString('base64url')
  const encoded = `${header}.${payload}`
  const signer = createSign('sha256')
  signer.update(encoded)
  signer.end()
  const signature = signer.sign(createPrivateKey(privateKeyPem)).toString('base64url')
  return `${encoded}.${signature}`
}

class ApnsClient {
  constructor({ teamId, keyId, bundleId, privateKeyPem, sandbox }) {
    this.teamId = teamId
    this.keyId = keyId
    this.bundleId = bundleId
    this.privateKeyPem = privateKeyPem
    this.origin = sandbox ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com'
    this.cachedToken = null
    this.cachedAt = 0
  }

  authToken() {
    const age = Math.floor(Date.now() / 1000) - this.cachedAt
    if (!this.cachedToken || age >= APNS_JWT_TTL_SECONDS) {
      this.cachedToken = buildApnsJwt(this.teamId, this.keyId, this.privateKeyPem)
      this.cachedAt = Math.floor(Date.now() / 1000)
    }
    return this.cachedToken
  }

  async send(deviceToken, payload) {
    const body = JSON.stringify(payload)
    return new Promise((resolve, reject) => {
      const client = connectHttp2(this.origin)
      client.on('error', reject)

      const stream = client.request({
        ':method': 'POST',
        ':path': `/3/device/${deviceToken}`,
        authorization: `bearer ${this.authToken()}`,
        'apns-topic': this.bundleId,
        'apns-push-type': 'alert',
        'content-type': 'application/json',
      })

      let responseHeaders
      let responseBody = ''
      stream.on('response', (headers) => {
        responseHeaders = headers
      })
      stream.on('data', (chunk) => {
        responseBody += chunk.toString()
      })
      stream.on('error', (error) => {
        client.close()
        reject(error)
      })
      stream.on('end', () => {
        const status = Number(responseHeaders?.[':status'] ?? 0)
        client.close()
        if (status >= 200 && status < 300) return resolve({ ok: true })
        let reason = null
        try {
          reason = JSON.parse(responseBody || '{}').reason ?? null
        } catch {
          reason = null
        }
        resolve({ ok: false, status, reason })
      })

      stream.end(body)
    })
  }
}

function parseNotificationPreferences(record) {
  return {
    clear_sky: record?.clear_sky ?? true,
    sky_events: record?.sky_events ?? true,
    challenges: record?.challenges ?? true,
  }
}

function categoryEnabled(preferences, category) {
  switch (category) {
    case 'clear_sky':
      return preferences.clear_sky
    case 'sky_events':
      return preferences.sky_events
    case 'challenges':
      return preferences.challenges
    default:
      return true
  }
}

async function loadUserDeliveryContext(pb, user, cache) {
  if (cache.has(user)) return cache.get(user)
  const [webSubscriptions, iosDevices, preferenceRows] = await Promise.all([
    pb.collection('atlas_push_subscriptions').getFullList({ filter: `user = "${user}"` }),
    pb.collection('atlas_push_devices').getFullList({ filter: `user = "${user}" && platform = "ios"` }).catch(() => []),
    pb.collection('atlas_notification_preferences').getFullList({ filter: `user = "${user}"`, sort: '-created' }).catch(() => []),
  ])
  const context = { webSubscriptions, iosDevices, preferences: parseNotificationPreferences(preferenceRows[0]) }
  cache.set(user, context)
  return context
}

function apnsBodyForMessage({ title, body, route, category }) {
  return {
    aps: {
      alert: { title, body },
      sound: 'default',
    },
    title,
    body,
    category,
    atlas_route: route.kind,
    event_id: route.eventId,
    challenge_id: route.challengeId,
    url: route.url,
  }
}

async function sendNotificationToUser(pb, options) {
  const {
    user,
    title,
    body,
    category,
    route,
    contextCache,
    apnsClient,
  } = options
  const context = await loadUserDeliveryContext(pb, user, contextCache)
  if (!categoryEnabled(context.preferences, category)) return { sent: 0, skipped: 'preference_off' }

  let sent = 0
  for (const subscription of context.webSubscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        JSON.stringify({ title, body, url: route.url, category, atlas_route: route.kind, event_id: route.eventId, challenge_id: route.challengeId }),
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

  if (apnsClient) {
    const payload = apnsBodyForMessage({ title, body, route, category })
    for (const device of context.iosDevices) {
      if (device.push_enabled === false) continue
      if (category === 'clear_sky' && device.clear_sky_enabled === false) continue
      if (category === 'sky_events' && device.sky_events_enabled === false) continue
      if (category === 'challenges' && device.challenges_enabled === false) continue
      const result = await apnsClient.send(device.token, payload)
      if (result.ok) {
        sent += 1
        continue
      }
      const stale = result.status === 410 || result.reason === 'Unregistered' || result.reason === 'BadDeviceToken'
      if (stale) {
        await pb.collection('atlas_push_devices').delete(device.id).catch(() => {})
      } else {
        console.error(`APNs send failed (${result.status ?? 'unknown'}) for ${device.id}:`, result.reason ?? 'unknown')
      }
    }
  }

  return { sent, skipped: sent === 0 ? 'no_subscription' : null }
}

async function sendGetReadyReminders(pb, now, contextCache, apnsClient) {
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

    try {
      const sentForReminder = await sendNotificationToUser(pb, {
        user: reminder.user,
        title: 'Atlas: get ready',
        body: reminderNotificationBody(reminder, condition),
        category: 'clear_sky',
        route: { kind: 'tonight', url: '/tonight?section=tonight&eventId=' + reminder.event_id, eventId: reminder.event_id },
        contextCache,
        apnsClient,
      })
      if (sentForReminder.skipped === 'preference_off') {
        await pb.collection('atlas_get_ready_reminders').update(reminder.id, { last_error: 'notifications_disabled' })
        await captureServerEvent(reminder.user, 'Reminder push skipped (server)', {
          reminderId: reminder.id,
          reason: 'notifications_disabled',
        })
        continue
      }
      const delivered = sentForReminder.sent
      if (delivered > 0) {
        await pb.collection('atlas_get_ready_reminders').update(reminder.id, {
          fired_at: new Date().toISOString(),
          skipped_reason: '',
          last_error: '',
        })
        sent += delivered
        await captureServerEvent(reminder.user, 'Reminder push delivered (server)', {
          reminderId: reminder.id,
          subscriptionCount: delivered,
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

async function sendWatchConfirmations(pb, contextCache, apnsClient) {
  const pending = await pb.collection('atlas_push_confirmation_queue').getFullList({
    filter: 'sent_at = ""',
  })
  let sent = 0
  let failed = 0
  for (const confirmation of pending) {
    try {
      const delivered = await sendNotificationToUser(pb, {
        user: confirmation.user,
        title: 'Atlas: watch registered',
        body: `You’re watching ${confirmation.title}. We’ll notify you when it’s a good time to look.`,
        category: 'sky_events',
        route: { kind: 'tonight_coming', url: '/tonight?section=coming&eventId=' + confirmation.event_id, eventId: confirmation.event_id },
        contextCache,
        apnsClient,
      })
      if (delivered.skipped === 'preference_off') {
        await pb.collection('atlas_push_confirmation_queue').update(confirmation.id, { last_error: 'notifications_disabled' })
        continue
      }
      if (delivered.sent > 0) {
        await pb.collection('atlas_push_confirmation_queue').update(confirmation.id, {
          sent_at: new Date().toISOString(),
          last_error: '',
        })
        sent += delivered.sent
      } else {
        await pb.collection('atlas_push_confirmation_queue').update(confirmation.id, { last_error: 'no_active_push_subscription' })
      }
    } catch (error) {
      await pb.collection('atlas_push_confirmation_queue').update(confirmation.id, { last_error: error.message ?? 'push_failed' })
      failed += 1
    }
  }
  return { sent, failed }
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
  const contextCache = new Map()
  const apnsPrivateKeyPem = normalizePrivateKey(APNS_PRIVATE_KEY)
  const apnsClient =
    APNS_TEAM_ID && APNS_KEY_ID && APNS_BUNDLE_ID && apnsPrivateKeyPem
      ? new ApnsClient({
          teamId: APNS_TEAM_ID,
          keyId: APNS_KEY_ID,
          bundleId: APNS_BUNDLE_ID,
          privateKeyPem: apnsPrivateKeyPem,
          sandbox: APNS_USE_SANDBOX,
        })
      : null
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
      // The marker is written only after delivery, but it still guards future
      // cron runs from sending the same event again.
      try {
        await pb.collection('atlas_notifications_sent').getFirstListItem(`user = "${entry.user}" && event = "${event.id}"`)
        continue
      } catch {
        // No delivered marker yet; continue through weather and push gates.
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

      let sentForEvent = 0
      try {
        const delivered = await sendNotificationToUser(pb, {
          user: entry.user,
          title: event.title,
          body: event.description || 'A good viewing opportunity is coming up.',
          category: 'sky_events',
          route: { kind: 'sky_event', url: `/tonight?section=coming&eventId=${event.id}`, eventId: event.id },
          contextCache,
          apnsClient,
        })
        if (delivered.skipped === 'preference_off') {
          await captureServerEvent(entry.user, 'Reminder push skipped (server)', {
            eventId: event.id,
            reason: 'notifications_disabled',
          })
          continue
        }
        sentForEvent = delivered.sent
        notified += sentForEvent
      } catch (error) {
        console.error(`Push failed for event ${event.id}:`, error.message)
      }

      if (sentForEvent === 0) {
        skippedNoSubscription += 1
        await captureServerEvent(entry.user, 'Reminder push skipped (server)', {
          eventId: event.id,
          reason: 'no_push_subscription',
        })
      }

      if (sentForEvent > 0) {
        // Only mark a notification as sent after at least one subscription
        // accepted it. Weather/no-subscription skips must remain retryable.
        try {
          await pb.collection('atlas_notifications_sent').create({ user: entry.user, event: event.id })
        } catch {
          // Another scheduled runner may have won the unique race.
        }
        await captureServerEvent(entry.user, 'Reminder push delivered (server)', {
          eventId: event.id,
          subscriptionCount: sentForEvent,
        })
      }
    }
  }

  const getReady = await sendGetReadyReminders(pb, now, contextCache, apnsClient)
  const watchConfirmations = await sendWatchConfirmations(pb, contextCache, apnsClient)

  console.log(
    `Notify complete: ${notified} watchlist pushes sent, ${skippedWeather} watchlist skipped for weather, ${skippedNoSubscription} watchlist skipped with no subscription. Watch confirmations: ${watchConfirmations.sent} sent, ${watchConfirmations.failed} failed. Get-ready: ${getReady.sent} pushes sent, ${getReady.skippedWeather} skipped for weather, ${getReady.skippedNoSubscription} skipped with no subscription, ${getReady.failed} failed.`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
