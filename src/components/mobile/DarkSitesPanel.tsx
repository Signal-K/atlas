import { rankDarkSkySites, directionsUrl } from '../../lib/darkSky'
import { BackIcon, MobileIcon } from './MobileIcon'

export function DarkSitesPanel({ lat, lon, cityName, onBack }: { lat: number; lon: number; cityName: string; onBack: () => void }) {
  const darkSites = rankDarkSkySites(lat, lon)

  return (
    <div className="mobile-plan">
      <section className="mobile-card">
        <button type="button" className="mobile-back mobile-plan-detail-back" onClick={onBack} aria-label="Back to plan">
          <BackIcon />
        </button>
        <div className="mobile-card-eyebrow mobile-card-eyebrow--icon">
          <MobileIcon name="mountain" /> Dark sites
        </div>
        <p className="mobile-empty-hint">Nearest dark-sky trip options ranked by drive time from {cityName}.</p>
        <div className="mobile-tool-list">
          {darkSites.map((site) => {
            const qualityPct = Math.round(((9 - site.bortleClass) / 8) * 100)
            return (
              <div className="mobile-tool-row" key={site.id}>
                <div className="mobile-tool-row-head">
                  <strong>{site.name}</strong>
                  <span>{site.estimatedTravelMinutes} MIN</span>
                </div>
                <div className="mobile-tool-bar">
                  <div className="mobile-tool-bar-fill" style={{ width: `${qualityPct}%` }} />
                </div>
                <div className="mobile-tool-row-foot">
                  <span>
                    BORTLE {site.bortleClass} &middot; {Math.round(site.distanceKm)} KM
                  </span>
                  <a href={directionsUrl(site)} target="_blank" rel="noreferrer">
                    Directions
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

export function darkSitesSummary(lat: number, lon: number) {
  const darkSites = rankDarkSkySites(lat, lon)
  return { count: darkSites.length, nearestMinutes: darkSites[0]?.estimatedTravelMinutes ?? null }
}
