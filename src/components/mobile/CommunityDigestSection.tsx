import { useEffect, useState } from 'react'
import { listDiscoveries, type Discovery } from '../../lib/discoveries'
import { HubIcon } from './HubIcon'

const WEEK_MS = 7 * 86_400_000

// Folded in from the old desktop widget stack (DigestWidget) so this week's
// top community discoveries aren't lost now that Today is HubView
// everywhere. Links through to Journal, where the Community sub-tab lives.
export function CommunityDigestSection({ onOpenJournal }: { onOpenJournal: () => void }) {
  const [top, setTop] = useState<Discovery[] | null>(null)

  useEffect(() => {
    let cancelled = false
    listDiscoveries()
      .then((all) => {
        if (cancelled) return
        const weekAgo = Date.now() - WEEK_MS
        const recent = all.filter((discovery) => new Date(discovery.created).getTime() >= weekAgo)
        setTop([...recent].sort((a, b) => b.voteCount - a.voteCount).slice(0, 3))
      })
      .catch(() => {
        if (!cancelled) setTop([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!top || top.length === 0) return null

  return (
    <>
      <div className="dt-stitch" />
      <section>
      <div className="dt-section-head">
        <span className="dt-section-eyebrow">
          <HubIcon name="spark" />
          This week&rsquo;s top discoveries
        </span>
        <button type="button" className="dt-chevron-btn" onClick={onOpenJournal} aria-label="Open community">
          <HubIcon name="chevron" />
        </button>
      </div>
      {top.map((discovery) => (
        <button type="button" className="dt-feed-row" key={discovery.id} onClick={onOpenJournal}>
          <div className="dt-feed-headline-row">
            <span className="dt-feed-headline">{discovery.caption}</span>
            <span className="dt-feed-chevron">▲ {discovery.voteCount}</span>
          </div>
          <span className="dt-feed-meta">
            {discovery.authorName}
            {discovery.target ? ` · ${discovery.target}` : ''}
          </span>
        </button>
      ))}
      </section>
    </>
  )
}
