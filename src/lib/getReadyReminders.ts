import { fetchViewingAdvisory } from './weather'
import { trackEvent } from './analytics'
import { pb } from './pocketbase'
import { getPushSubscription, isPushSupported, subscribeToPush } from './push'

export type ReminderFeedbackOutcome = 'saw_it' | 'partial' | 'clouded_out'

export interface ReminderFeedback {
  outcome: ReminderFeedbackOutcome
  note?: string
  recordedAt: string
}

export interface GetReadyReminder {
  id: string
  eventId: string
  title: string
  kind?: string
  target?: string
  startsAt: string
  endsAt?: string
  remindAt: string
  deviceName: string
  lat?: number
  lon?: number
  directionLabel?: string
  cloudCoverPct?: number | null
  precipitationChancePct?: number | null
  firedAt?: string
  skippedReason?: string
  feedback?: ReminderFeedback
  createdAt: string
}

const STORAGE_KEY = 'atlas-get-ready-reminders'
const SIGHTING_PROFILE_KEY = 'atlas-sighting-feedback-profile'

interface SightingProfileTarget {
  confirmed: number
  partial: number
  cloudedOut: number
  lastOutcome: ReminderFeedbackOutcome
  lastSeenAt: string
}

interface SightingProfile {
  targets: Record<string, SightingProfileTarget>
  kinds: Record<string, SightingProfileTarget>
  harderTargetsUnlockedAt?: string
}

function readRaw(): GetReadyReminder[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as GetReadyReminder[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeRaw(reminders: GetReadyReminder[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders))
  window.dispatchEvent(new Event('atlas:get-ready-reminders-changed'))
}

export function listGetReadyReminders(now = new Date()): GetReadyReminder[] {
  return readRaw()
    .filter((reminder) => new Date(reminder.startsAt).getTime() >= now.getTime() - 30 * 60_000)
    .sort((a, b) => a.remindAt.localeCompare(b.remindAt))
}

export function listPendingReminderFeedback(now = new Date()): GetReadyReminder[] {
  return readRaw()
    .filter((reminder) => !reminder.feedback)
    .filter((reminder) => new Date(reminder.endsAt ?? reminder.startsAt).getTime() < now.getTime())
    .filter((reminder) => new Date(reminder.endsAt ?? reminder.startsAt).getTime() > now.getTime() - 7 * 86_400_000)
    .sort((a, b) => (a.endsAt ?? a.startsAt).localeCompare(b.endsAt ?? b.startsAt))
}

export async function addGetReadyReminder(input: {
  eventId: string
  title: string
  kind?: string
  target?: string
  startsAt: string
  endsAt?: string
  deviceName: string
  minutesBefore?: number
  lat?: number
  lon?: number
  directionLabel?: string
  cloudCoverPct?: number | null
  precipitationChancePct?: number | null
}): Promise<GetReadyReminder> {
  const minutesBefore = input.minutesBefore ?? 0
  const startsAtMs = new Date(input.startsAt).getTime()
  const remindAt = new Date(startsAtMs - minutesBefore * 60_000).toISOString()
  const existing = readRaw().filter((reminder) => reminder.eventId !== input.eventId)
  const reminder: GetReadyReminder = {
    id: crypto.randomUUID(),
    eventId: input.eventId,
    title: input.title,
    kind: input.kind,
    target: input.target,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    remindAt,
    deviceName: input.deviceName,
    lat: input.lat,
    lon: input.lon,
    directionLabel: input.directionLabel,
    cloudCoverPct: input.cloudCoverPct,
    precipitationChancePct: input.precipitationChancePct,
    createdAt: new Date().toISOString(),
  }

  writeRaw([...existing, reminder])
  const pushedToWorker = await pushReminder(reminder)
  if (!pushedToWorker) scheduleReminder(reminder)
  return reminder
}

export function scheduleStoredReminders() {
  for (const reminder of listGetReadyReminders()) scheduleReminder(reminder)
}

function scheduleReminder(reminder: GetReadyReminder) {
  const delay = new Date(reminder.remindAt).getTime() - Date.now()
  if (delay <= 0 || delay > 24 * 60 * 60_000) return

  window.setTimeout(async () => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    const condition = await currentConditionForReminder(reminder)
    if (!condition.acceptable) {
      updateReminder(reminder.id, {
        skippedReason: condition.reason,
      })
      trackEvent('Get-ready notification skipped', {
        eventId: reminder.eventId,
        title: reminder.title,
        reason: condition.reason,
      })
      return
    }
    new Notification('Atlas: get ready', {
      body: notificationBody(reminder, condition),
      tag: `atlas-${reminder.eventId}`,
    })
    updateReminder(reminder.id, { firedAt: new Date().toISOString(), skippedReason: undefined })
    trackEvent('Get-ready notification shown', { eventId: reminder.eventId, title: reminder.title })
  }, delay)
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'denied') return false
  const granted = Notification.permission === 'granted' || (await Notification.requestPermission()) === 'granted'
  if (!granted) return false

  if (pb.authStore.isValid && isPushSupported()) {
    try {
      await subscribeToPush()
    } catch {
      // Browser notifications are still available as a local fallback.
    }
  }

  return true
}

export function recordReminderFeedback(reminderId: string, feedback: Omit<ReminderFeedback, 'recordedAt'>) {
  const reminder = readRaw().find((item) => item.id === reminderId)
  if (!reminder) return
  const recorded: ReminderFeedback = { ...feedback, recordedAt: new Date().toISOString() }
  updateReminder(reminderId, { feedback: recorded })
  updateSightingProfile(reminder, recorded)
  window.dispatchEvent(new Event('atlas:reminder-feedback-changed'))
}

export function getSightingProfile(): SightingProfile {
  try {
    const parsed = JSON.parse(localStorage.getItem(SIGHTING_PROFILE_KEY) ?? '{}') as Partial<SightingProfile>
    return {
      targets: parsed.targets ?? {},
      kinds: parsed.kinds ?? {},
      harderTargetsUnlockedAt: parsed.harderTargetsUnlockedAt,
    }
  } catch {
    return { targets: {}, kinds: {} }
  }
}

function updateReminder(reminderId: string, patch: Partial<GetReadyReminder>) {
  writeRaw(readRaw().map((reminder) => (reminder.id === reminderId ? { ...reminder, ...patch } : reminder)))
}

async function pushReminder(reminder: GetReadyReminder): Promise<boolean> {
  if (!pb.authStore.isValid || !navigator.onLine) return false
  const subscription = await getPushSubscription().catch(() => null)
  if (!subscription) return false
  const user = pb.authStore.record?.id
  if (!user) return false

  const payload = {
    user,
    local_id: reminder.id,
    event_id: reminder.eventId,
    title: reminder.title,
    kind: reminder.kind,
    target: reminder.target,
    starts_at: reminder.startsAt,
    ends_at: reminder.endsAt,
    remind_at: reminder.remindAt,
    device_name: reminder.deviceName,
    latitude: reminder.lat,
    longitude: reminder.lon,
    direction_label: reminder.directionLabel,
    cloud_cover_pct: reminder.cloudCoverPct,
    precipitation_chance_pct: reminder.precipitationChancePct,
  }

  try {
    const existing = await pb.collection('atlas_get_ready_reminders').getFirstListItem(`event_id = "${reminder.eventId}"`)
    await pb.collection('atlas_get_ready_reminders').update(existing.id, payload)
    return true
  } catch {
    try {
      await pb.collection('atlas_get_ready_reminders').create(payload)
      return true
    } catch {
      // Local reminder remains armed even if the server-side worker record
      // cannot be written yet.
      return false
    }
  }
}

function updateSightingProfile(reminder: GetReadyReminder, feedback: ReminderFeedback) {
  const profile = getSightingProfile()

  function bump(bucket: Record<string, SightingProfileTarget>, key: string | undefined) {
    if (!key) return
    const current = bucket[key] ?? { confirmed: 0, partial: 0, cloudedOut: 0, lastOutcome: feedback.outcome, lastSeenAt: feedback.recordedAt }
    bucket[key] = {
      confirmed: current.confirmed + (feedback.outcome === 'saw_it' ? 1 : 0),
      partial: current.partial + (feedback.outcome === 'partial' ? 1 : 0),
      cloudedOut: current.cloudedOut + (feedback.outcome === 'clouded_out' ? 1 : 0),
      lastOutcome: feedback.outcome,
      lastSeenAt: feedback.recordedAt,
    }
  }

  bump(profile.targets, reminder.target ?? reminder.title)
  bump(profile.kinds, reminder.kind)

  const confirmedSightings = Object.values(profile.targets).reduce((total, target) => total + target.confirmed, 0)
  if (confirmedSightings >= 2 && !profile.harderTargetsUnlockedAt) {
    profile.harderTargetsUnlockedAt = feedback.recordedAt
  }

  localStorage.setItem(SIGHTING_PROFILE_KEY, JSON.stringify(profile))
}

function formatWindowDuration(reminder: GetReadyReminder): string {
  const start = new Date(reminder.startsAt).getTime()
  const end = new Date(reminder.endsAt ?? reminder.startsAt).getTime()
  const minutes = Math.max(5, Math.round((end - start) / 60_000))
  if (minutes >= 90) return `about ${Math.round(minutes / 60)} hours`
  return `about ${minutes} minutes`
}

function conditionCopy(cloudCoverPct: number | null | undefined, precipitationChancePct: number | null | undefined): string {
  if (cloudCoverPct == null) return 'sky check unavailable'
  const sky = cloudCoverPct < 30 ? 'clear sky' : cloudCoverPct < 70 ? 'partly cloudy sky' : 'cloudy sky'
  if (precipitationChancePct != null && precipitationChancePct >= 20) return `${sky}, ${Math.round(precipitationChancePct)}% rain chance`
  return `${sky}, ${Math.round(cloudCoverPct)}% cloud`
}

function notificationBody(reminder: GetReadyReminder, condition: { cloudCoverPct?: number | null; precipitationChancePct?: number | null }) {
  const direction = reminder.directionLabel ? ` Look ${reminder.directionLabel}.` : ''
  return `${reminder.title} is visible now for ${formatWindowDuration(reminder)}. ${conditionCopy(
    condition.cloudCoverPct ?? reminder.cloudCoverPct,
    condition.precipitationChancePct ?? reminder.precipitationChancePct,
  )}.${direction} Set up ${reminder.deviceName}.`
}

async function currentConditionForReminder(reminder: GetReadyReminder): Promise<{
  acceptable: boolean
  reason?: string
  cloudCoverPct?: number | null
  precipitationChancePct?: number | null
}> {
  let cloudCoverPct = reminder.cloudCoverPct
  let precipitationChancePct = reminder.precipitationChancePct

  if (reminder.lat != null && reminder.lon != null) {
    try {
      const days = await fetchViewingAdvisory(reminder.lat, reminder.lon, 7)
      const day = days.find((item) => item.date === reminder.startsAt.slice(0, 10))
      if (day) {
        cloudCoverPct = day.cloudCoverPct
        precipitationChancePct = day.precipitationChancePct
      }
    } catch {
      // Use the stored advisory snapshot when the live weather check fails.
    }
  }

  if (cloudCoverPct != null && cloudCoverPct >= 75) return { acceptable: false, reason: 'clouded_out', cloudCoverPct, precipitationChancePct }
  if (precipitationChancePct != null && precipitationChancePct >= 50) return { acceptable: false, reason: 'rain_risk', cloudCoverPct, precipitationChancePct }
  return { acceptable: true, cloudCoverPct, precipitationChancePct }
}
