import { useEffect, useState } from 'react'
import { getEventsInRange, pullSkyEvents } from '../lib/sync'
import { GUIDE_KIND_IDS } from '../lib/eventCategories'
import { KIND_LABELS } from '../widgets/EventRow'
import type { SkyEvent } from '../lib/db'

// "Ability to see the Daily Transit articles from the Atlas app" (clarified
// from the notebook notes). Guide-kind events (comet tracker, night-sky
// guides, local night-sky roundups) are evergreen editorial content, not
// dated events -- see eventCategories.ts's GUIDE_KIND_IDS comment. They read
// badly inside a day-by-day calendar, so this renders them as a standalone
// article list instead.
const WINDOW_DAYS_PAST = 14
const WINDOW_DAYS_FUTURE = 270

export function DailyTransitArticles() {
  const [articles, setArticles] = useState<SkyEvent[] | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      await pullSkyEvents()
      const start = new Date(Date.now() - WINDOW_DAYS_PAST * 86_400_000)
      const end = new Date(Date.now() + WINDOW_DAYS_FUTURE * 86_400_000)
      const events = await getEventsInRange(start, end)
      const guides = events
        .filter((event) => GUIDE_KIND_IDS.has(event.kind))
        .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
      if (!cancelled) setArticles(guides)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (articles === null) return <p>Loading&hellip;</p>
  if (articles.length === 0) return <p className="scrapbook-hint">No Daily Transit guides available right now.</p>

  return (
    <ul className="dt-article-list">
      {articles.map((article) => (
        <li key={article.id} className="dt-article-card">
          {article.imageUrl && (
            <figure className="dt-article-image">
              <img src={article.imageUrl} alt={article.title} loading="lazy" />
              {article.imageCredit && <figcaption>{article.imageCredit}</figcaption>}
            </figure>
          )}
          <div className="dt-article-body">
            <span className="dt-article-kicker">{KIND_LABELS[article.kind] ?? 'Guide'}</span>
            <h3 className="dt-article-title">{article.title}</h3>
            <p className="dt-article-text">{article.content ?? article.description}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}
