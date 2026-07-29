import {
  estimateLightPollution,
  rankLowerLightPollutionSites,
  skyQualityLabelForScore,
  tripComparisonNote,
  tripSiteQualityLabel,
} from '../../lib/darkSky'
import { NativeRoutePicker } from '../NativeRoutePicker'
import { BackIcon, MobileIcon } from './MobileIcon'

export function DarkSitesPanel({ lat, lon, cityName, onBack }: { lat: number; lon: number; cityName: string; onBack: () => void }) {
  const lightPollution = estimateLightPollution(lat, lon)
  const darkSites = rankLowerLightPollutionSites(lat, lon, 3)
  const origin = { lat, lon }

  return (
    <div className="mobile-plan">
      <section className="mobile-card">
        <button type="button" className="mobile-back mobile-plan-detail-back" onClick={onBack} aria-label="Back to plan">
          <BackIcon />
        </button>
        <div className="mobile-card-eyebrow mobile-card-eyebrow--icon">
          <MobileIcon name="mountain" /> Dark sites
        </div>
        <p className="mobile-empty-hint">
          Sky near {cityName}: <strong>{lightPollution.skyQualityScore}/5 · {skyQualityLabelForScore(lightPollution.skyQualityScore)}</strong>{' '}
          ({lightPollution.confidence === 'curated-site' ? 'based on a known site' : 'estimated from nearby city lights'}).
        </p>
        <p className="mobile-empty-hint">Darker-sky options within four hours by road, ranked by trip time.</p>
        {darkSites.length === 0 && <p className="mobile-empty-hint">No quick trip is in the catalog yet. Atlas won&apos;t suggest a flight as a local observing trip.</p>}
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
                    {tripSiteQualityLabel(site.bortleClass).toUpperCase()} &middot;{' '}
                    {tripComparisonNote(site.lightPollutionDelta).toUpperCase()} &middot;{' '}
                    {Math.round(site.distanceKm)} KM
                  </span>
                </div>
                <NativeRoutePicker site={site} origin={origin} compact />
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

export function darkSitesSummary(lat: number, lon: number) {
  const darkSites = rankLowerLightPollutionSites(lat, lon, 3)
  return { count: darkSites.length, nearestMinutes: darkSites[0]?.estimatedTravelMinutes ?? null }
}
