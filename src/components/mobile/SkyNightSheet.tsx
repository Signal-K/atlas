import { useState } from 'react'
import { Sheet } from './Sheet'
import { useToast } from './Toast'
import { db, type ObservationLogEntry } from '../../lib/db'
import { useAuth } from '../../lib/auth'
import { trackEvent } from '../../lib/analytics'
import { describeAward, progressAnalyticsEvents } from '../../lib/progress'
import { snapshotProgress } from '../../lib/progressSnapshot'
import { syncXpLedgerSoon } from '../../lib/xpLedger'

const LOCAL_USER_ID = 'local'

function todayLocalDate(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

// ASV-92: a self-reported community sky night. Deliberately local-only (no
// push to the shared backend) and manual: no RSVP, ticket or host check, so
// the tour and the host mailto can never stand in for attendance.
export function SkyNightSheet({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth()
  const toast = useToast()
  const scopeId = user?.id ?? LOCAL_USER_ID
  const [city, setCity] = useState('')
  const [date, setDate] = useState(todayLocalDate)
  const [saving, setSaving] = useState(false)

  async function save() {
    const label = city.trim()
    if (!label || !date || saving) return
    setSaving(true)
    const entry: ObservationLogEntry = {
      id: crypto.randomUUID(),
      userId: scopeId,
      // Noon keeps the civil date stable across timezones (see civilDate).
      observedAt: `${date}T12:00:00.000Z`,
      targetName: 'Community sky night',
      locationLabel: label,
      communityNightHost: label,
      anchorSource: 'manual',
    }
    const before = await snapshotProgress(scopeId, user?.firstTourBadge ?? null)
    await db.observations.add(entry)
    const after = await snapshotProgress(scopeId, user?.firstTourBadge ?? null)
    for (const event of progressAnalyticsEvents(before, after, 'sky_night')) trackEvent(event.name, event.properties)
    void syncXpLedgerSoon()
    setSaving(false)
    toast(describeAward(before, after, { label: 'Sky night logged' }))
    setCity('')
    onSaved()
    onClose()
  }

  return (
    <Sheet open={open} title="I went to a sky night" onClose={onClose}>
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span className="az-kicker">Host city</span>
          <input className="az-input" value={city} onChange={(event) => setCity(event.target.value)} placeholder="e.g. Tallinn" />
        </label>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span className="az-kicker">Date</span>
          <input className="az-input" type="date" value={date} max={todayLocalDate()} onChange={(event) => setDate(event.target.value)} />
        </label>
        <button type="button" className="az-btn az-btn-primary az-btn-block" disabled={!city.trim() || !date || saving} onClick={() => void save()}>
          Log sky night
        </button>
      </div>
    </Sheet>
  )
}
