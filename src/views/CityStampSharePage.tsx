import { useEffect, useState } from 'react'
import { getPublicCityStamp, type PublicCityStamp } from '../lib/cityStamps'
import { PublicShareRecovery } from '../components/PublicShareRecovery'

export function CityStampSharePage({ slug }: { slug: string }) {
  const [stamp, setStamp] = useState<PublicCityStamp | null | 'loading'>('loading')

  useEffect(() => {
    getPublicCityStamp(slug).then((data) => setStamp(data))
  }, [slug])

  if (stamp === 'loading') {
    return <PublicShareRecovery item="city stamp" state="loading" />
  }

  if (!stamp) {
    return <PublicShareRecovery item="city stamp" state="unavailable" />
  }

  return (
      <article className="share-card city-stamp-share-card">
        <span className="city-stamp-share-kicker">Atlas city stamp</span>
        <h1>{stamp.cityName}</h1>
        <p>
          {stamp.checkinCount} check-in{stamp.checkinCount === 1 ? '' : 's'} logged here.
        </p>
        <dl>
          <div>
            <dt>First check-in</dt>
            <dd>{new Date(stamp.firstCheckedInAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</dd>
          </div>
          <div>
            <dt>Latest check-in</dt>
            <dd>{new Date(stamp.lastCheckedInAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</dd>
          </div>
        </dl>
      </article>
  )
}
