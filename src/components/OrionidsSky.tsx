import { liveShowerCampaign } from '../lib/spacetober.mjs'

// Fixed, click-through haze while a shower campaign is inside its gold window.
// Cool white and blue only. Motion is limited to prefers-reduced-motion:
// no-preference; the streaks stay faint when motion is reduced so the sky
// still reads as a shower. Queued showers draw nothing before their dates.
export function OrionidsSky() {
  if (!liveShowerCampaign(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone)) return null
  return (
    <div className="orionids-sky" aria-hidden="true">
      <div className="orionids-haze" />
      <span className="orionids-streak" style={{ top: '18%', left: '12%', animationDelay: '0s' }} />
      <span className="orionids-streak" style={{ top: '36%', left: '58%', animationDelay: '2.4s' }} />
      <span className="orionids-streak" style={{ top: '62%', left: '28%', animationDelay: '4.8s' }} />
      <span className="orionids-streak orionids-streak-short" style={{ top: '24%', left: '78%', animationDelay: '1.2s' }} />
    </div>
  )
}
