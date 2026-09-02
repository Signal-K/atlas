import { useEffect, useState } from 'react'
import { MobileIcon } from '../components/mobile/MobileIcon'
import { StatGrid } from '../components/mobile/StatGrid'
import { CaptureSheet, RATING_HUE, RATING_LABEL } from '../components/mobile/CaptureSheet'
import { EntryDetailSheet } from '../components/mobile/JournalSheets'
import { JournalCommunity } from '../components/mobile/JournalCommunity'
import { useEntryPhotoUrl } from '../lib/useEntryPhotoUrl'
import { db, type ObservationLogEntry } from '../lib/db'
import { cityStampsFromObservations } from '../lib/cityStamps'
import { categoryForKind } from '../lib/eventCategories'
import { useAuth } from '../lib/auth'
import type { ObservationDraft } from '../lib/observationDraft'
import type { CurrentLocation } from '../lib/currentLocation'

const LOCAL_USER_ID = 'local'

export interface JournalPageProps {
  draft: ObservationDraft | null
  onDraftConsumed: () => void
  currentLocation: CurrentLocation
}

function JournalEntryRow({ entry, kindLabel, onOpen }: { entry: ObservationLogEntry; kindLabel?: string; onOpen: () => void }) {
  const photoUrl = useEntryPhotoUrl(entry.photo)
  const tags = [entry.deviceUsed, kindLabel].filter(Boolean) as string[]

  return (
    <button type="button" className="az-row" onClick={onOpen} style={{ alignItems: 'flex-start' }}>
      <span
        className={`az-thumb${photoUrl ? '' : ' az-thumb-empty'}`}
        style={photoUrl ? { backgroundImage: `url(${photoUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      >
        {!photoUrl && 'NOTE'}
      </span>
      <span className="az-row-main">
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.1875rem' }}>
          {entry.attemptRating && (
            <span className="az-pill" style={{ '--pill-hue': RATING_HUE[entry.attemptRating] } as React.CSSProperties}>
              {RATING_LABEL[entry.attemptRating].toUpperCase()}
            </span>
          )}
          <span className="az-row-kind" style={{ margin: 0 }}>
            {new Date(entry.observedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }).toUpperCase()}
          </span>
        </span>
        <span className="az-row-title">{entry.targetName ?? 'Observation'}</span>
        {entry.note && <span className="az-row-value">{entry.note}</span>}
        {tags.length > 0 && (
          <span className="az-chip-row" style={{ marginTop: '0.375rem' }}>
            {tags.map((tag) => (
              <span key={tag} className="az-chip" style={{ cursor: 'default', minHeight: 'auto', padding: '0.25rem 0.5625rem', fontSize: '0.6875rem' }}>
                {tag}
              </span>
            ))}
          </span>
        )}
      </span>
      <span className="az-row-chevron">
        <MobileIcon name="chevron" size={14} />
      </span>
    </button>
  )
}

// Journal is the Mine/Community split from the Atlas Mobile design: a
// private capture composer + entry list ("Mine"), and the shared photo
// challenge/discovery feed ("Community"). Digest and Leaderboard are folded
// into Community's header rather than kept as separate tabs.
export function JournalPage({ draft, onDraftConsumed, currentLocation }: JournalPageProps) {
  const { user } = useAuth()
  const scopeId = user?.id ?? LOCAL_USER_ID
  const [tab, setTab] = useState<'mine' | 'community'>('mine')
  const [entries, setEntries] = useState<ObservationLogEntry[]>([])
  const [eventKindById, setEventKindById] = useState<Map<string, string>>(new Map())
  const [captureOpen, setCaptureOpen] = useState(false)
  const [openEntry, setOpenEntry] = useState<ObservationLogEntry | null>(null)

  async function refresh() {
    const all = await db.observations.where('userId').equals(scopeId).reverse().sortBy('observedAt')
    setEntries(all)

    const eventIds = [...new Set(all.map((entry) => entry.eventId).filter((id): id is string => Boolean(id)))]
    if (eventIds.length === 0) {
      setEventKindById(new Map())
      return
    }
    const events = await db.skyEvents.bulkGet(eventIds)
    setEventKindById(new Map(events.filter(Boolean).map((event) => [event!.id, event!.kind])))
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeId])

  // A draft handed off from an event's "Log attempt" button always means
  // "open the composer on Mine, pre-filled" -- regardless of which tab the
  // user last had open.
  useEffect(() => {
    if (draft) {
      setTab('mine')
      setCaptureOpen(true)
    }
  }, [draft])

  const nightsOut = new Set(entries.map((entry) => entry.observedAt.slice(0, 10))).size
  // "First seen": distinct named targets logged at least once -- the
  // closest real proxy to "first sighting count" the data supports (there's
  // no separate "seen before" flag on an entry).
  const firstSeen = new Set(entries.map((entry) => entry.targetName).filter(Boolean)).size
  const places = cityStampsFromObservations(entries).length

  return (
    <div className="az-page">
      <h1 className="az-h1">Journal</h1>
      <p className="az-hero-title">Attempts count. Private until you share.</p>

      <div className="az-seg" style={{ marginTop: '0.875rem' }}>
        <button type="button" className={`az-seg-btn${tab === 'mine' ? ' is-active' : ''}`} onClick={() => setTab('mine')}>
          Mine
        </button>
        <button type="button" className={`az-seg-btn${tab === 'community' ? ' is-active' : ''}`} onClick={() => setTab('community')}>
          Community
        </button>
      </div>

      {tab === 'mine' && (
        <>
          <div style={{ marginTop: '1rem' }}>
            <StatGrid
              stats={[
                { value: String(nightsOut), label: 'NIGHTS OUT' },
                { value: String(firstSeen), label: 'FIRST SEEN' },
                { value: String(places), label: 'PLACES' },
              ]}
            />
          </div>

          <button type="button" className="az-btn az-btn-dashed az-btn-block" style={{ marginTop: '0.875rem' }} onClick={() => setCaptureOpen(true)}>
            + Log tonight's session
          </button>

          <div className="az-section-head">
            <span className="az-kicker">Your entries</span>
          </div>
          {entries.length === 0 ? (
            <p className="az-muted">Nothing logged yet — your sky-watching notes will show up here.</p>
          ) : (
            <div className="az-row-group">
              {entries.map((entry) => (
                <JournalEntryRow
                  key={entry.id}
                  entry={entry}
                  kindLabel={entry.eventId ? categoryForKind(eventKindById.get(entry.eventId) ?? '')?.label : undefined}
                  onOpen={() => setOpenEntry(entry)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'community' && <JournalCommunity />}

      <CaptureSheet
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        draft={draft}
        onDraftConsumed={onDraftConsumed}
        currentLocation={currentLocation}
        onSaved={refresh}
      />

      <EntryDetailSheet entry={openEntry} onClose={() => setOpenEntry(null)} onShared={refresh} />
    </div>
  )
}
