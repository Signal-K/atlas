import {
  estimateLightPollution,
  formatTripDriveTime,
  rankLowerLightPollutionSites,
  skyQualityLabelForScore,
  tripComparisonNote,
  tripSiteQualityLabel,
} from '../lib/darkSky'
import { trackEvent } from '../lib/analytics'
import { tourAffiliateUrl } from '../lib/affiliate'
import { NativeRoutePicker } from '../components/NativeRoutePicker'

// STS-172: dark-sky site finder + trip planning. Separate from
// LocalOpsView.tsx/localOps.ts (an unrelated local PocketBase diagnostics
// dashboard) -- despite the ticket's original name, this is new, unrelated
// functionality.

export function DarkSkyView({ lat, lon }: { lat: number; lon: number }) {
  const lightPollution = estimateLightPollution(lat, lon)
  const sites = rankLowerLightPollutionSites(lat, lon, 3)
  const origin = { lat, lon }

  return (
    <section className="widget-section">
      <h2>Dark-sky trips</h2>
      <p className="darksky-hint">
        Sky near you: <strong>{lightPollution.skyQualityScore}/5 · {skyQualityLabelForScore(lightPollution.skyQualityScore)}</strong>{' '}
        ({lightPollution.confidence === 'curated-site' ? 'based on a known site' : 'a coarse estimate from nearby city lights'}). Nearby options are
        ranked by straight-line proximity; open the map route for real travel time.
      </p>
      {sites.length === 0 && <p className="darksky-hint">No darker-sky places are in the quick-trip range yet. Atlas won&apos;t suggest a flight as a local observing trip.</p>}
      <ul className="row-list darksky-list">
        {sites.map((site) => (
          <li key={site.id} className="darksky-site">
            <div className="darksky-site-header">
              <span className="darksky-site-name">{site.name}</span>
              <span className={`darksky-bortle darksky-bortle--${site.bortleClass}`} title={`Technical reference: Bortle ${site.bortleClass} of 9`}>
                {tripSiteQualityLabel(site.bortleClass)}
              </span>
            </div>
            <p className="darksky-site-meta">
              {site.distanceKm.toFixed(0)} km · {tripComparisonNote(site.lightPollutionDelta)} ·{' '}
              {formatTripDriveTime(site.estimatedTravelMinutes)} by straight-line estimate
            </p>
            <p className="darksky-site-notes">{site.notes}</p>
            <NativeRoutePicker site={site} origin={origin} />
            <div className="darksky-site-actions">
              {tourAffiliateUrl(site.name) && (
                <a
                  href={tourAffiliateUrl(site.name)!}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="darksky-tour-link"
                  onClick={() => trackEvent('Opened dark-sky tour link', { site: site.id })}
                >
                  Find tours &amp; stays nearby
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
