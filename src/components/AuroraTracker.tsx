import { useEffect, useMemo, useState } from 'react'
import { getEventsInRange, pullSkyEvents } from '../lib/sync'
import { addGetReadyReminder, ensureNotificationPermission, listGetReadyReminders } from '../lib/getReadyReminders'
import { auroraAlertsEnabled, auroraCallLabel, auroraSnapshot, setAuroraAlertsEnabled, type AuroraSnapshot } from '../lib/auroraTracker'
import { CAMERA_PROFILES, getDefaultDevice } from '../lib/cameraProfiles'
import type { CurrentLocation } from '../lib/currentLocation'
import type { SkyEvent } from '../lib/db'

export function AuroraTracker({ location }: { location: CurrentLocation }) {
  const { lat: locationLat, lon: locationLon } = location
  const [events, setEvents] = useState<SkyEvent[] | null>(null)
  const [alertsEnabled, setAlertsEnabled] = useState(() => auroraAlertsEnabled())
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<AuroraSnapshot>(() => auroraSnapshot(null, location))

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        await pullSkyEvents()
        const now = new Date()
        const upcoming = await getEventsInRange(now, new Date(now.getTime() + 3 * 86_400_000))
        if (!cancelled) {
          setEvents(upcoming)
          setSnapshot(auroraSnapshot(upcoming, { lat: locationLat, lon: locationLon }))
        }
      } catch {
        if (!cancelled) setEvents(null)
      }
    }
    load()
    return () => { cancelled = true }
  }, [locationLat, locationLon])

  const currentSnapshot = useMemo(() => auroraSnapshot(events, { lat: locationLat, lon: locationLon }), [events, locationLat, locationLon])
  const activeSnapshot = events === null ? snapshot : currentSnapshot

  async function toggleAlerts() {
    setBusy(true)
    setMessage(null)
    try {
      if (alertsEnabled) {
        setAuroraAlertsEnabled(false)
        setAlertsEnabled(false)
        setMessage('Aurora alerts disabled.')
        return
      }
      const granted = await ensureNotificationPermission({ force: true })
      setAuroraAlertsEnabled(true)
      setAlertsEnabled(true)
      if (activeSnapshot.nextEvent) {
        const existing = listGetReadyReminders().some((reminder) => reminder.eventId === activeSnapshot.nextEvent?.id)
        if (!existing) {
          await addGetReadyReminder({
            eventId: activeSnapshot.nextEvent.id,
            title: activeSnapshot.nextEvent.title,
            kind: activeSnapshot.nextEvent.kind,
            target: activeSnapshot.nextEvent.target,
            startsAt: activeSnapshot.nextEvent.startsAt,
            endsAt: activeSnapshot.nextEvent.endsAt,
            minutesBefore: 30,
            deviceName: CAMERA_PROFILES[getDefaultDevice()].name,
            lat: locationLat,
            lon: locationLon,
          })
        }
      }
      setMessage(granted ? 'Alerts enabled — Atlas will check the next visible forecast.' : 'Alerts saved, but browser notifications are not enabled.')
    } catch {
      setMessage('Could not enable alerts. Try again from this device.')
    } finally {
      setBusy(false)
    }
  }

  const eventTime = activeSnapshot.nextEvent
    ? new Date(activeSnapshot.nextEvent.startsAt).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })
    : null

  return (
    <section className={`aurora-tracker aurora-tracker--${activeSnapshot.call}`} aria-label="Aurora tracker">
      <div className="aurora-tracker-head">
        <div>
          <span className="settings-detail-kicker">Location-aware extras</span>
          <h3>Aurora tracker</h3>
        </div>
        <strong className="aurora-tracker-call">{auroraCallLabel(activeSnapshot.call)}</strong>
      </div>
      <p className="aurora-tracker-reason">{activeSnapshot.reason}</p>
      {activeSnapshot.nextEvent && <p className="aurora-tracker-event">{activeSnapshot.nextEvent.title} · {eventTime}</p>}
      <div className="aurora-tracker-actions">
        <span className="settings-status">{alertsEnabled ? 'Alerts on' : 'Alerts off'}</span>
        <button type="button" onClick={toggleAlerts} disabled={busy}>
          {busy ? 'Checking…' : alertsEnabled ? 'Turn off alerts' : 'Alert me when visible'}
        </button>
      </div>
      {message && <p className="settings-help" role="status">{message}</p>}
      <p className="settings-help">Uses your saved location and NOAA’s forecast. Atlas says UNKNOWN when the feed is unavailable rather than guessing.</p>
    </section>
  )
}
