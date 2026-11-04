import { useMemo, useState } from 'react'
import { trackEvent } from '../lib/analytics'
import {
  buildDeepSkyTonight,
  DEEP_SKY_GEAR,
  defaultGearFromEquipment,
  readStoredGear,
  storeGear,
  type DeepSkyGear,
} from '../lib/deepSkyTonight'
import { getEquipmentChoice } from '../lib/firstPlanJourney'

export interface DeepSkyTonightCardProps {
  lat: number
  lon: number
  timeZone?: string
  /** Injected so tests can pin the night; defaults to the current time. */
  now?: Date
}

function initialGear(): DeepSkyGear {
  let fromOnboarding = null
  try {
    fromOnboarding = getEquipmentChoice()
  } catch {
    // localStorage can be unavailable; fall back to the naked-eye default.
  }
  return readStoredGear() ?? defaultGearFromEquipment(fromOnboarding)
}

function timeLabel(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  })
}

const TITLES: Record<DeepSkyGear, string> = {
  eye: 'Under the dark sky tonight',
  binoculars: 'Through your binoculars tonight',
  small: 'Through your telescope tonight',
  large: 'Through your telescope tonight',
}

export function DeepSkyTonightCard({ lat, lon, timeZone, now }: DeepSkyTonightCardProps) {
  const [gear, setGear] = useState<DeepSkyGear>(initialGear)
  const night = useMemo(
    () => buildDeepSkyTonight({ now: now ?? new Date(), lat, lon, timeZone, gear }),
    [now, lat, lon, timeZone, gear],
  )

  function chooseGear(next: DeepSkyGear) {
    setGear(next)
    storeGear(next)
    trackEvent('Changed deep sky gear', { gear: next })
  }

  return (
    <section className="deep-sky-card az-card" aria-label="Deep sky tonight">
      <div className="az-card-body">
        <span className="az-kicker">Deep sky tonight</span>
        <h2 className="deep-sky-title">{TITLES[gear]}</h2>
        <p className="deep-sky-summary" aria-live="polite">{night.summary}</p>

        <div className="az-chip-row" role="group" aria-label="Your gear">
          {DEEP_SKY_GEAR.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`az-chip${option.id === gear ? ' is-active' : ''}`}
              aria-pressed={option.id === gear}
              onClick={() => chooseGear(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <ol className="deep-sky-list">
          {night.picks.map((pick) => (
            <li key={pick.id} className="deep-sky-pick" data-pick-id={pick.id}>
              <div className="deep-sky-pick-head">
                <span className="deep-sky-pick-name">{pick.name}</span>
                <span className="deep-sky-pick-class">{pick.classLabel}</span>
              </div>
              <p className="deep-sky-pick-when">
                Best around {timeLabel(pick.bestAt, timeZone)} · {pick.direction} ({pick.altitudeDeg}° up, {pick.compassLabel})
                {pick.constellation ? ` · ${pick.constellation}` : ''}
              </p>
              <p className="deep-sky-pick-how">{pick.howTo}</p>
              {pick.moonPenalty >= 0.3 && (
                <p className="deep-sky-pick-moon">Moonlight will wash this out a little{pick.moonSeparationDeg !== null ? ` (${pick.moonSeparationDeg}° from the Moon)` : ''}.</p>
              )}
            </li>
          ))}
        </ol>

        {night.window && (
          <p className="deep-sky-foot">
            Dark from {timeLabel(night.window.start, timeZone)} to {timeLabel(night.window.end, timeZone)} · Moon {night.moon.illuminationPct}% lit
          </p>
        )}
      </div>
    </section>
  )
}
