import { useEffect, useId, useState } from 'react'
import type { ObservationLogEntry } from '../lib/db'
import { ObservationCard } from './ObservationCard'
import { PostShareDialog } from './PostShareDialog'
import './EventObservationThread.css'

export interface EventObservationThreadProps {
  eventId: string
  title: string
  entries: ObservationLogEntry[]
  canShare: boolean
  onShareToFeed: (entry: ObservationLogEntry) => void
  onCreateShareLink: (entry: ObservationLogEntry) => Promise<string>
}

function ThreadPreview({ entry }: { entry: ObservationLogEntry }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!entry.photo || !entry.photo.type.startsWith('image/')) {
      setPhotoUrl(null)
      setFailed(false)
      return
    }
    const nextUrl = URL.createObjectURL(entry.photo)
    setPhotoUrl(nextUrl)
    setFailed(false)
    return () => {
      URL.revokeObjectURL(nextUrl)
    }
  }, [entry.photo])

  if (photoUrl && !failed) return <img src={photoUrl} alt="" onError={() => setFailed(true)} />
  return <span className="event-thread-note-preview" aria-label="Written observation">✦</span>
}

function threadDate(entries: ObservationLogEntry[]): string {
  const newest = new Date(entries[0].observedAt)
  const oldest = new Date(entries.at(-1)?.observedAt ?? entries[0].observedAt)
  const format = (value: Date) => value.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return newest.toDateString() === oldest.toDateString() ? format(newest) : `${format(oldest)}–${format(newest)}`
}

export function EventObservationThread({
  eventId,
  title,
  entries,
  canShare,
  onShareToFeed,
  onCreateShareLink,
}: EventObservationThreadProps) {
  const [expanded, setExpanded] = useState(false)
  const contentId = useId()
  const previews = entries.slice(0, 6)
  const remaining = entries.length - previews.length

  return (
    <li className="event-thread" data-event-id={eventId}>
      <button
        type="button"
        className="event-thread-summary"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded((current) => !current)}
      >
        <span className="event-thread-kicker">Event thread</span>
        <span className="event-thread-title">{title}</span>
        <span className="event-thread-meta">
          {entries.length} post{entries.length === 1 ? '' : 's'} · {threadDate(entries)}
        </span>
        <span className="event-thread-portfolio" aria-hidden="true">
          {previews.map((entry) => (
            <span className="event-thread-preview" key={entry.id}>
              <ThreadPreview entry={entry} />
            </span>
          ))}
          {remaining > 0 && <span className="event-thread-more">+{remaining}</span>}
        </span>
        <span className="event-thread-toggle">{expanded ? 'Hide posts' : 'Open portfolio'}</span>
      </button>

      {expanded && (
        <ol className="event-thread-posts" id={contentId}>
          {entries.map((entry) => (
            <li className="event-thread-post" key={entry.id}>
              <ObservationCard entry={entry} />
              {canShare && (
                <div className="scrapbook-entry-footer">
                  <button type="button" className="scrapbook-share" onClick={() => onShareToFeed(entry)} disabled={entry.sharedToFeed}>
                    {entry.sharedToFeed ? 'Shared to Feed' : 'Share to Feed'}
                  </button>
                  <PostShareDialog onCreateLink={() => onCreateShareLink(entry)} />
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </li>
  )
}
