import { Link } from 'react-router-dom'
import { LANDNAM_ORIONIDS_URL, spacetoberStripVisible } from '../lib/spacetober.mjs'

export function SpacetoberStrip() {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  if (!spacetoberStripVisible(new Date(), zone)) return null
  return (
    <section className="spacetober-strip" aria-label="Spacetober">
      <p className="az-kicker">Spacetober</p>
      <p>
        World Space Week runs 4–10 October. The Orionids stay active through 7 November, with the peak night on 21–22
        October.
      </p>
      <p className="orionids-banner-links">
        <Link to="/app/orionids">Fireballs in the Sky</Link>
        <a href={LANDNAM_ORIONIDS_URL}>Play the Orionids in Landnam</a>
      </p>
    </section>
  )
}
