import { estimateLightPollution, lightPollutionLabel, rankLowerLightPollutionSites } from '../../lib/darkSky'
import { NativeRoutePicker } from '../NativeRoutePicker'
import { BackIcon, MobileIcon } from './MobileIcon'

// Sites this far out are more "theoretical" than "trip-worthy" -- the
// underlying catalog (src/lib/darkSky.ts) is currently weighted toward
// Europe/NZ/Australia/the Americas, so anyone in, say, East or South Asia
// sees only very distant options. Rather than let that read as broken,
// call out the coverage gap once it's this extreme.
const FAR_TRAVEL_MINUTES_THRESHOLD = 240

export function DarkSitesPanel({ lat, lon, cityName, onBack }: { lat: number; lon: number; cityName: string; onBack: () => void }) {
  const lightPollution = estimateLightPollution(lat, lon)
  const darkSites = rankLowerLightPollutionSites(lat, lon)
  const nearestMinutes = darkSites[0]?.estimatedTravelMinutes ?? 0
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
          Sky near {cityName} right now: {lightPollution.label} ({lightPollution.confidence === 'curated-site' ? 'curated site' : 'estimated'}
          , Bortle {lightPollution.bortleClass} of 9 — 1 is the darkest sky, 9 the brightest).
        </p>
        <p className="mobile-empty-hint">Lower light-pollution options ranked by trip time, with estimated sky improvement.</p>
        {nearestMinutes > FAR_TRAVEL_MINUTES_THRESHOLD && (
          <p className="mobile-empty-hint">
            Our dark-sky site database is still Europe/US/Australia-focused, so nearby options can be sparse elsewhere — these are the
            closest known sites, not necessarily close by.
          </p>
        )}
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
                    {lightPollutionLabel(site.bortleClass).toUpperCase()} &middot;{' '}
                    {(site.lightPollutionDelta ?? 0) > 0 ? 'NOTICEABLY DARKER THAN HOME' : 'BEST KNOWN MATCH'} &middot;{' '}
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
  const darkSites = rankLowerLightPollutionSites(lat, lon)
  return { count: darkSites.length, nearestMinutes: darkSites[0]?.estimatedTravelMinutes ?? null }
}
