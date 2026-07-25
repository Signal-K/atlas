import { useEffect, useState } from 'react'
import { dailyTransitArticleUrl, DAILY_TRANSIT_SITE_URL, fetchDailyTransitArticles, type DailyTransitArticle } from '../lib/dailyTransit'
import { trackEvent } from '../lib/analytics'

// "Ability to see the Daily Transit articles from the Atlas app" (clarified
// by Liam: TDT / thedailytransit.com, part of the signal-k/saily repo --
// a real sibling product, not anything generated inside Atlas). Shows the
// latest published articles with a link out to the full read on
// thedailytransit.com, rather than duplicating its CMS/markdown rendering
// here.
export function DailyTransitArticles() {
  const [articles, setArticles] = useState<DailyTransitArticle[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchDailyTransitArticles(5).then((result) => {
      if (!cancelled) setArticles(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (articles === null) return <p>Loading&hellip;</p>
  if (articles.length === 0) {
    return (
      <p className="scrapbook-hint">
        No Daily Transit articles published yet. <a href={DAILY_TRANSIT_SITE_URL} target="_blank" rel="noreferrer">Visit thedailytransit.com</a>
      </p>
    )
  }

  return (
    <ul className="dt-article-list">
      {articles.map((article) => (
        <li key={article.id} className="dt-article-card">
          {article.heroImage && (
            <figure className="dt-article-image">
              <img src={article.heroImage} alt={article.title} loading="lazy" />
            </figure>
          )}
          <div className="dt-article-body">
            <span className="dt-article-kicker">The Daily Transit</span>
            <h3 className="dt-article-title">{article.title}</h3>
            <p className="dt-article-text">{article.summary}</p>
            <a
              className="dt-article-link"
              href={dailyTransitArticleUrl(article.slug)}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackEvent('Daily Transit article opened', { slug: article.slug })}
            >
              Read on thedailytransit.com →
            </a>
          </div>
        </li>
      ))}
    </ul>
  )
}
