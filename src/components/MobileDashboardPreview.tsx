import { Link } from 'react-router-dom'
import { SkyMapCanvas } from './SkyMapCanvas'
import { HubIcon } from './mobile/HubIcon'
import { estimateLightPollution } from '../lib/darkSky'
import { formatWatchValue } from '../lib/watchlist'
import type { TonightPlan } from '../lib/tonightTargets'
import type { CurrentLocation } from '../lib/currentLocation'

function formatTime(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone })
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

// Requested directly: a way to see the mobile "Today" dashboard's widget
// grid + map-preview style next to the desktop Tonight view's existing
// list-based layout, on the same page, to compare the two design
// directions rather than deciding blind. Reuses HubView's own data shape
// (TonightPlan, CurrentLocation) so the numbers match exactly -- this is
// not a separate data source, just a second rendering of the same plan.
export function MobileDashboardPreview({ city, plan }: { city: CurrentLocation; plan: TonightPlan }) {
  const topTarget = plan.targets[0]
  const advisory = plan.todayAdvisory
  const darkAt = plan.darknessWindow.astronomicalDuskAt
  const cloudCover = advisory ? `${Math.round(advisory.cloudCoverPct)}%` : '—'
  const lowCloud = advisory?.lowCloudCoverPct == null ? '—' : `${Math.round(advisory.lowCloudCoverPct)}%`
  const highCloud = advisory?.highCloudCoverPct == null ? '—' : `${Math.round(advisory.highCloudCoverPct)}%`
  const visibility = advisory ? formatWatchValue(advisory.quality) : '—'
  const moon = `${Math.round(plan.moonIlluminationPct)}%`
  const lightPollution = estimateLightPollution(city.lat, city.lon)
  const clarity = advisory ? Math.max(0, 100 - advisory.cloudCoverPct) : 70

  return (
    <section className="widget-section mobile-dashboard-preview">
      <div className="mobile-dashboard-preview-header">
        <h2>Mobile-style dashboard (comparison)</h2>
        <p className="scrapbook-hint">
          Same tonight&apos;s plan as above, laid out like the mobile Today tab&apos;s widget grid -- here to compare side by side, not a
          finished replacement.
        </p>
      </div>
      <div className="dt-bracket dt-map-preview mobile-dashboard-preview-map">
        <span className="dt-bc-tr" />
        <span className="dt-bc-bl" />
        <div className="sky-map-frame sky-map-frame--hub">
          <SkyMapCanvas clarity={clarity} date={new Date()} lat={city.lat} lon={city.lon} markerLabel={topTarget?.title} markerPosition={topTarget?.direction} presentation="full" />
        </div>
        <Link to="/app/sky-map" className="dt-map-preview-label" style={{ position: 'relative', zIndex: 1 }}>
          Open full sky map
        </Link>
      </div>
      <div className="dt-map-readout">
        <span>LAT {city.lat.toFixed(2)}</span>
        <span>LON {city.lon.toFixed(2)}</span>
        <span>{topTarget?.direction ? `${topTarget.direction.compassLabel} ${Math.round(topTarget.direction.altitudeDeg)}° ALT` : 'NO TARGET'}</span>
      </div>
      <div className="dt-widget-grid">
        <div className="dt-widget-cell dt-widget-cell--wide">
          <span className="dt-widget-eyebrow"><HubIcon name="target" />Next up</span>
          <span className="dt-widget-value">{topTarget ? topTarget.title : 'No local target'}</span>
          <span className="dt-widget-caption">{topTarget ? formatTime(topTarget.bestTime, plan.timeZone) : 'Check again later'}</span>
        </div>
        <div className="dt-widget-cell">
          <span className="dt-widget-eyebrow"><HubIcon name="cloud" />Cloud</span>
          <span className="dt-widget-value">{cloudCover}</span>
          <span className="dt-widget-caption">{visibility} · low {lowCloud} · high {highCloud}</span>
        </div>
        <div className="dt-widget-cell">
          <span className="dt-widget-eyebrow"><HubIcon name="moon" />Moon</span>
          <span className="dt-widget-value">{moon}</span>
          <span className="dt-widget-caption">illumination</span>
        </div>
        <div className="dt-widget-cell">
          <span className="dt-widget-eyebrow"><HubIcon name="clock" />Dark</span>
          <span className="dt-widget-value">{darkAt ? formatTime(darkAt, plan.timeZone) : '—'}</span>
          <span className="dt-widget-caption">astro dusk</span>
        </div>
        <div className="dt-widget-cell">
          <span className="dt-widget-eyebrow"><HubIcon name="sun" />Sunset</span>
          <span className="dt-widget-value">{plan.darknessWindow.civilDuskAt ? formatTime(plan.darknessWindow.civilDuskAt, plan.timeZone) : '—'}</span>
          <span className="dt-widget-caption">{city.name}</span>
        </div>
        <div className="dt-widget-cell" title={`Bortle ${lightPollution.bortleClass} of 9`}>
          <span className="dt-widget-eyebrow"><HubIcon name="spark" />Light</span>
          <span className="dt-widget-value">{capitalize(lightPollution.label)}</span>
          <span className="dt-widget-caption">Bortle {lightPollution.bortleClass} of 9</span>
        </div>
      </div>
    </section>
  )
}
