import { Link } from 'react-router-dom'
import { LANDNAM_ORIONIDS_URL, ORIONIDS_EVENT_ID, liveShowerCampaign } from '../lib/spacetober.mjs'

// Shown to every signed-in user and every guest, with no location check.
// Only the shower whose gold window contains today is announced. Leonids and
// Geminids stay quiet until their own dates.
export function OrionidsBanner() {
  const campaign = liveShowerCampaign(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone)
  if (!campaign) return null
  return (
    <aside className="orionids-banner" role="status">
      <p>
        <strong>{campaign.bannerStrong}</strong>
        {campaign.bannerRest}
      </p>
      {campaign.eventId === ORIONIDS_EVENT_ID ? (
        <p className="orionids-banner-links">
          <Link to="/app/orionids">Read about fireballs</Link>
          <a href={LANDNAM_ORIONIDS_URL}>Play the Orionids in Landnam</a>
        </p>
      ) : null}
    </aside>
  )
}
