import { rankDarkSkySites, directionsUrl, type RankedDarkSkySite } from '../lib/darkSky'
import { trackEvent } from '../lib/analytics'
import { tourAffiliateUrl } from '../lib/affiliate'

// STS-172: dark-sky site finder + trip planning. Separate from
// LocalOpsView.tsx/localOps.ts (an unrelated local PocketBase diagnostics
// dashboard) -- despite the ticket's original name, this is new, unrelated
// functionality.
// Sites this far out are more "theoretical" than "trip-worthy" -- the
// underlying catalog (src/lib/darkSky.ts) is currently weighted toward
// Europe/NZ/Australia/the Americas, so anyone in, say, East or South Asia
// sees only very distant options. Rather than let that read as broken,
// call out the coverage gap once it's this extreme.
const FAR_TRAVEL_MINUTES_THRESHOLD = 240

export function DarkSkyView({ lat, lon }: { lat: number; lon: number }) {
  const sites: RankedDarkSkySite[] = rankDarkSkySites(lat, lon)
  const nearestMinutes = sites[0]?.estimatedTravelMinutes ?? 0

  function openDirections(site: RankedDarkSkySite) {
    trackEvent('Opened dark-sky directions', { site: site.id })
    window.open(directionsUrl(site), '_blank', 'noopener,noreferrer')
  }

  return (
    <section className="widget-section">
      <h2>Dark-sky trips</h2>
      <p className="darksky-hint">
        Nearby dark-sky sites ranked by distance from your current location, with an approximate Bortle scale rating
        (1 = darkest, 9 = inner-city).
      </p>
      {nearestMinutes > FAR_TRAVEL_MINUTES_THRESHOLD && (
        <p className="darksky-hint">
          Our dark-sky site database is still Europe/US/Australia-focused, so nearby options can be sparse elsewhere — these are the
          closest known sites, not necessarily close by.
        </p>
      )}
      <ul className="row-list darksky-list">
        {sites.map((site) => (
          <li key={site.id} className="darksky-site">
            <div className="darksky-site-header">
              <span className="darksky-site-name">{site.name}</span>
              <span className={`darksky-bortle darksky-bortle--${site.bortleClass}`}>Bortle {site.bortleClass}</span>
            </div>
            <p className="darksky-site-meta">
              {site.distanceKm.toFixed(0)} km · ~{Math.round(site.estimatedTravelMinutes / 60)}h{' '}
              {site.estimatedTravelMinutes % 60}m drive (estimated)
            </p>
            <p className="darksky-site-notes">{site.notes}</p>
            <div className="darksky-site-actions">
              <button type="button" className="darksky-directions" onClick={() => openDirections(site)}>
                Get directions
              </button>
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
