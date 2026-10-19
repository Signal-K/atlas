import { Link } from 'react-router-dom'
import { orionidsActivity } from '../lib/eventSources/meteor-showers.mjs'
import { LANDNAM_ORIONIDS_URL, orionidsLive } from '../lib/spacetober.mjs'

// Shown to every signed-in user and every guest, with no location check.
// The Orionids are a worldwide shower; the best-time hint is the campaign
// stand-in (after moonset, about 02:00 local on 21–22 October).
export function OrionidsBanner() {
  const activity = orionidsActivity(2026)
  if (!orionidsLive(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone, activity)) return null
  return (
    <aside className="orionids-banner" role="status">
      <p>
        <strong>The Orionids are happening</strong> through 7 November. The peak night is 21–22 October. Best viewing
        is after moonset, about 02:00 local.
      </p>
      <p className="orionids-banner-links">
        <Link to="/app/orionids">Read about fireballs</Link>
        <a href={LANDNAM_ORIONIDS_URL}>Play the Orionids in Landnam</a>
      </p>
    </aside>
  )
}
