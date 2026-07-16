export interface GetReadyReminder {
  id: string
  eventId: string
  title: string
  startsAt: string
  remindAt: string
  deviceName: string
  createdAt: string
}

const STORAGE_KEY = 'atlas-get-ready-reminders'

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

export async function addGetReadyReminder(input: {
  eventId: string
  title: string
  startsAt: string
  deviceName: string
  minutesBefore?: number
}): Promise<GetReadyReminder> {
  const minutesBefore = input.minutesBefore ?? 30
  const startsAtMs = new Date(input.startsAt).getTime()
  const remindAt = new Date(startsAtMs - minutesBefore * 60_000).toISOString()
  const existing = readRaw().filter((reminder) => reminder.eventId !== input.eventId)
  const reminder: GetReadyReminder = {
    id: crypto.randomUUID(),
    eventId: input.eventId,
    title: input.title,
    startsAt: input.startsAt,
    remindAt,
    deviceName: input.deviceName,
    createdAt: new Date().toISOString(),
  }

  writeRaw([...existing, reminder])
  scheduleReminder(reminder)
  return reminder
}

export function scheduleStoredReminders() {
  for (const reminder of listGetReadyReminders()) scheduleReminder(reminder)
}

function scheduleReminder(reminder: GetReadyReminder) {
  const delay = new Date(reminder.remindAt).getTime() - Date.now()
  if (delay <= 0 || delay > 24 * 60 * 60_000) return

  window.setTimeout(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    new Notification('Atlas: get ready', {
      body: `${reminder.title} starts soon. Set up ${reminder.deviceName}.`,
      tag: `atlas-${reminder.eventId}`,
    })
  }, delay)
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  return (await Notification.requestPermission()) === 'granted'
}
