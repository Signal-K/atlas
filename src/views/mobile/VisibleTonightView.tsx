import { useEffect, useState } from 'react'
import '../../mobile.css'
import { getTonightPlan, type TonightPlan, type TonightTarget } from '../../lib/tonightTargets'
import { fetchViewingAdvisory, type DailyViewingAdvisory } from '../../lib/weather'
import { categoryForKind } from '../../lib/eventCategories'
import { getVisibleStarsTonight, type VisibleStarTonight } from '../../lib/visibleStarsTonight'
import {
  buildEventDetail,
  buildStarDetail,
  bvToHex,
  colorLabelForBv,
  detailInputFromTonightTarget,
  formatTimeLabel,
  starTransitTime,
  type EntryDetailSubject,
} from '../../lib/entryDetail'
import { BackIcon } from '../../components/mobile/MobileIcon'
import type { CurrentLocation } from '../../lib/currentLocation'

interface VisibleTonightViewProps {
  city: CurrentLocation
  onClose: () => void
  onOpenEntry: (subject: EntryDetailSubject) => void
}

const RATING_COPY: Record<TonightPlan['rating'], { label: string; className: string }> = {
  great: { label: 'Great conditions', className: 'is-great' },
  good: { label: 'Good conditions', className: 'is-great' },
  maybe: { label: 'Worth a look', className: 'is-maybe' },
  poor: { label: 'Poor conditions', className: 'is-poor' },
  skip: { label: 'Skip tonight', className: 'is-poor' },
}

function formatDarknessWindow(window: TonightPlan['darknessWindow']): string | null {
  if (!window.astronomicalDuskAt || !window.astronomicalDawnAt) return null
  return `Astronomically dark ${formatTimeLabel(window.astronomicalDuskAt)}–${formatTimeLabel(window.astronomicalDawnAt)}`
}

export function VisibleTonightView({ city, onClose, onOpenEntry }: VisibleTonightViewProps) {
  const [plan, setPlan] = useState<TonightPlan | null>(null)
  const [advisory, setAdvisory] = useState<DailyViewingAdvisory | null>(null)
  const [stars, setStars] = useState<VisibleStarTonight[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [tonightPlan, advisoryDays] = await Promise.all([
        getTonightPlan(city.lat, city.lon, new Date(), city.timeZone),
        fetchViewingAdvisory(city.lat, city.lon, 1).catch(() => []),
      ])
      if (cancelled) return
      setPlan(tonightPlan)
      setAdvisory(advisoryDays[0] ?? null)
      setStars(getVisibleStarsTonight(new Date(), city.lat, city.lon))
    }
    load()
    return () => {
      cancelled = true
    }
  }, [city])

  function openTarget(target: TonightTarget) {
    if (!plan) return
    const subject = buildEventDetail(detailInputFromTonightTarget(target, plan.moonIlluminationPct, plan.darknessWindow), advisory)
    onOpenEntry(subject)
  }

  function openStar(entry: VisibleStarTonight) {
    if (!plan) return
    const subject = buildStarDetail(entry.star, entry, plan.moonIlluminationPct, plan.darknessWindow, city.lon, advisory)
    onOpenEntry(subject)
  }

  const rating = plan ? RATING_COPY[plan.rating] : null
  const darknessLabel = plan ? formatDarknessWindow(plan.darknessWindow) : null

  return (
    <div className="dt-visible-tonight">
      <div className="dt-visible-tonight-head">
        <button type="button" className="dt-entry-back" onClick={onClose}>
          <BackIcon />
          <span>Back</span>
        </button>
        <span className="dt-kicker">Tonight &middot; {city.name}</span>
        <h2 className="dt-h2">Visible Tonight</h2>
        {rating && (
          <span className={`dt-visible-tonight-rating ${rating.className}`}>
            {rating.label}
            {plan?.todayAdvisory && ` — ${Math.round(plan.todayAdvisory.cloudCoverPct)}% cloud, ${Math.round(plan.moonIlluminationPct)}% moon`}
          </span>
        )}
        {darknessLabel && <div className="dt-visible-tonight-darkness">{darknessLabel}</div>}
      </div>

      <div className="dt-visible-tonight-scroll">
        {!plan ? (
          <p className="dt-empty-hint">Loading tonight&rsquo;s sky&hellip;</p>
        ) : (
          <>
            <div className="dt-section-eyebrow">Events tonight</div>
            {plan.targets.length === 0 ? (
              <p className="dt-empty-hint">No events cached for tonight yet.</p>
            ) : (
              plan.targets.map((target) => {
                const accent = categoryForKind(target.kind)?.accent ?? '#0a82b3'
                return (
                  <button type="button" key={target.eventId} className="dt-visible-row" onClick={() => openTarget(target)}>
                    <span className="dt-visible-row-dot" style={{ background: accent }} />
                    <span className="dt-visible-row-main">
                      <span className="dt-visible-row-name">{target.title}</span>
                      <span className="dt-visible-row-meta">
                        {target.nakedEyeVisible ? 'Naked-eye' : 'Needs optics'}
                        {target.direction ? ` · ${target.direction.compassLabel}, ${Math.round(target.direction.altitudeDeg)}°` : ''}
                      </span>
                    </span>
                    <span className="dt-visible-row-time">{formatTimeLabel(target.bestTime)}</span>
                    <span className={`dt-visible-row-badge${target.phoneFriendly ? ' is-filled' : ''}`}>
                      {target.phoneFriendly ? 'Phone' : 'Eyes'}
                    </span>
                  </button>
                )
              })
            )}

            <div className="dt-section-eyebrow" style={{ marginTop: 20 }}>
              Brightest stars out tonight
            </div>
            {stars.length === 0 ? (
              <p className="dt-empty-hint">No bright stars above the horizon right now.</p>
            ) : (
              stars.map((entry) => {
                const bv = entry.star.colorIndex ?? 0
                const color = bvToHex(bv)
                const phoneFriendly = entry.star.magnitude <= 1.0
                const cameraNote = phoneFriendly ? 'phone, tripod' : entry.star.magnitude <= 1.6 ? 'binoculars best' : 'naked eye'
                return (
                  <button type="button" key={entry.star.id} className="dt-visible-row dt-visible-row--star" onClick={() => openStar(entry)}>
                    <span className="dt-visible-row-star-dot" style={{ background: color }} />
                    <span className="dt-visible-row-main">
                      <span className="dt-visible-row-name">{entry.star.name}</span>
                      <span className="dt-visible-row-meta">
                        mag {entry.star.magnitude.toFixed(2)} &middot; {colorLabelForBv(bv)}
                      </span>
                    </span>
                    <span className="dt-visible-row-time">{formatTimeLabel(starBestTime(entry, city.lon, plan).toISOString())}</span>
                    <span className="dt-visible-row-camera-note">{cameraNote}</span>
                  </button>
                )
              })
            )}
          </>
        )}
      </div>
    </div>
  )
}

function starBestTime(entry: VisibleStarTonight, lon: number, plan: TonightPlan): Date {
  const from = plan.darknessWindow.astronomicalDuskAt ? new Date(plan.darknessWindow.astronomicalDuskAt) : new Date()
  return starTransitTime(entry.star.raHours, lon, from)
}
