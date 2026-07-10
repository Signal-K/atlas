import { useEffect, useState } from 'react'
import { registerWidget } from './registry'
import { listDiscoveries, type Discovery } from '../lib/discoveries'

const WEEK_MS = 7 * 86_400_000

function DigestWidget() {
  const [top, setTop] = useState<Discovery[] | null>(null)

  useEffect(() => {
    let cancelled = false
    listDiscoveries().then((all) => {
      if (cancelled) return
      const weekAgo = Date.now() - WEEK_MS
      const recent = all.filter((discovery) => new Date(discovery.created).getTime() >= weekAgo)
      const ranked = [...recent].sort((a, b) => b.voteCount - a.voteCount).slice(0, 3)
      setTop(ranked)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (top === null) return <p>Loading&hellip;</p>
  if (top.length === 0) return <p>No discoveries shared this week yet — be the first, over in the Feed tab.</p>

  return (
    <ul className="digest-list">
      {top.map((discovery) => (
        <li key={discovery.id} className="digest-item">
          {discovery.imageUrl && <img className="digest-image" src={discovery.imageUrl} alt={discovery.caption} loading="lazy" />}
          <div className="digest-body">
            <p className="digest-caption">{discovery.caption}</p>
            <p className="digest-meta">
              {discovery.authorName} &middot; ▲ {discovery.voteCount}
              {discovery.target && <> &middot; {discovery.target}</>}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}

registerWidget({
  id: 'digest',
  title: "This week's top discoveries",
  Component: DigestWidget,
  defaultEnabled: true,
})
