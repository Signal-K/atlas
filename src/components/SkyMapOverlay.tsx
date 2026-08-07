import { useEffect, useMemo, useState } from 'react'
import { SkyMapCanvas } from './SkyMapCanvas'
import { turnInstruction, type DevicePointing } from '../lib/deviceCompass'
import { getSkyMapObjects, type SkyMapObject } from '../lib/skyMapLayers'
import { findSkyMapObjectFromQuery } from '../lib/skyMapSearch'
import type { HorizontalPosition } from '../lib/skyPosition'

interface SkyMapOverlayProps {
  cityName: string
  clarity?: number | null
  lat: number
  lon: number
  targetLabel?: string
  targetPosition?: HorizontalPosition | null
  compassStatus: 'idle' | 'unsupported' | 'denied' | 'active'
  pointing?: DevicePointing | null
  onEnableCompass: () => void
  onClose: () => void
}

function targetSummary(targetPosition?: HorizontalPosition | null): string {
  if (!targetPosition) return 'No target selected'
  if (targetPosition.altitudeDeg <= 0) return `${targetPosition.compassLabel} · below horizon`
  return `${targetPosition.compassLabel} · ${Math.round(targetPosition.altitudeDeg)}° alt`
}

function guidance(pointing: DevicePointing | null | undefined, targetPosition?: HorizontalPosition | null): string {
  if (!targetPosition) return 'Explore visible sky'
  if (targetPosition.altitudeDeg <= 0) return 'Target below horizon'
  if (pointing?.headingDeg == null) return 'Compass off'
  return turnInstruction(pointing.headingDeg, targetPosition.azimuthDeg)
}

function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

function dateFromMinutes(minutes: number): Date {
  const date = new Date()
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return date
}

function formatMapTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function objectTypeLabel(object: SkyMapObject): string {
  if (object.kind === 'deep_sky') return object.objectType ?? 'deep sky'
  return object.kind.replace('_', ' ')
}

function formatOptionalNumber(value: number | undefined, suffix = ''): string | null {
  if (value == null || Number.isNaN(value)) return null
  return `${Number(value.toFixed(1))}${suffix}`
}

// Plain-language gloss before the raw magnitude number -- same pattern as
// the Bortle scale in darkSky.ts (translate first, show the technical value
// second), so a beginner isn't handed a bare astronomy number to decode.
function brightnessLabel(magnitude: number | undefined): string | null {
  if (magnitude == null || Number.isNaN(magnitude)) return null
  if (magnitude <= 1) return 'Very bright'
  if (magnitude <= 3) return 'Easy naked-eye'
  if (magnitude <= 4.5) return 'Naked-eye'
  if (magnitude <= 6.5) return 'Naked-eye in a dark sky'
  return 'Binoculars help here'
}

function estimatePointingAltitude(pitchDeg: number | null): number {
  if (pitchDeg == null) return 0
  return Math.max(0, Math.min(90, 90 - Math.abs(pitchDeg)))
}

function angularDeltaDeg(a: number, b: number): number {
  return Math.abs((((a - b + 180) % 360) + 360) % 360 - 180)
}

function objectPointingScore(object: SkyMapObject, pointing: DevicePointing): number {
  if (pointing.headingDeg == null) return Number.POSITIVE_INFINITY
  const altitudeDeg = estimatePointingAltitude(pointing.pitchDeg)
  return angularDeltaDeg(object.azimuthDeg, pointing.headingDeg) + Math.abs(object.altitudeDeg - altitudeDeg) * 0.85
}

export function SkyMapOverlay({
  cityName,
  clarity,
  lat,
  lon,
  targetLabel,
  targetPosition,
  compassStatus,
  pointing,
  onEnableCompass,
  onClose,
}: SkyMapOverlayProps) {
  // Unknown weather should not be presented as a measured percentage. Keep
  // the map legible with a neutral rendering value, but label it unavailable.
  const renderedClarity = clarity ?? 70
  const activePointing = compassStatus === 'active' ? pointing : null
  const [timeMinutes, setTimeMinutes] = useState(() => minutesSinceMidnight(new Date()))
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchStatus, setSearchStatus] = useState<'idle' | 'found' | 'not-found'>('idle')
  const mapDate = useMemo(() => dateFromMinutes(timeMinutes), [timeMinutes])
  const visibleObjects = useMemo(
    () =>
      getSkyMapObjects(mapDate, lat, lon)
        .filter((object) => object.visible && object.kind !== 'sun')
        .sort((a, b) => {
          const aRank = a.kind === 'moon' ? -20 : a.kind === 'planet' ? -14 : a.kind === 'deep_sky' ? -8 : 0
          const bRank = b.kind === 'moon' ? -20 : b.kind === 'planet' ? -14 : b.kind === 'deep_sky' ? -8 : 0
          return aRank + (a.magnitude ?? 5) - (bRank + (b.magnitude ?? 5))
        })
        .slice(0, 8),
    [lat, lon, mapDate],
  )
  const allVisibleObjects = useMemo(() => getSkyMapObjects(mapDate, lat, lon).filter((object) => object.visible), [lat, lon, mapDate])
  const selectedObject = selectedObjectId ? allVisibleObjects.find((object) => object.id === selectedObjectId) ?? null : null
  const pointedObject = useMemo(() => {
    if (activePointing?.headingDeg == null) return null
    const nearest = allVisibleObjects
      .filter((object) => object.kind !== 'sun')
      .map((object) => ({ object, score: objectPointingScore(object, activePointing) }))
      .sort((a, b) => a.score - b.score)[0]
    return nearest && nearest.score <= 18 ? nearest.object : null
  }, [activePointing, allVisibleObjects])
  const activeTitle = selectedObject?.name ?? targetLabel ?? 'Visible sky'
  const pointingTitle = pointedObject?.name ?? 'Open sky'
  const pointingDetail =
    compassStatus === 'active' && activePointing?.headingDeg != null
      ? `${Math.round(activePointing.headingDeg)}° heading · ${Math.round(estimatePointingAltitude(activePointing.pitchDeg))}° up`
      : compassStatus === 'denied'
        ? 'Compass permission denied'
        : compassStatus === 'unsupported'
          ? 'Compass unavailable'
          : 'Enable compass to aim the map'

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  function toggleSelectedObject(object: SkyMapObject) {
    setSelectedObjectId((current) => (current === object.id ? null : object.id))
  }

  function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault()
    const match = findSkyMapObjectFromQuery(searchQuery, allVisibleObjects)
    if (match) {
      setSelectedObjectId(match.id)
      setSearchStatus('found')
    } else {
      setSearchStatus('not-found')
    }
  }

  return (
    <div className="mobile-map-overlay" role="dialog" aria-modal="true" aria-label="Live sky map">
      <div className="mobile-map-overlay-head">
        <div>
          <span>Live sky</span>
          <strong>{activeTitle}</strong>
        </div>
        <button type="button" onClick={onClose} aria-label="Close sky map">
          Close
        </button>
      </div>

      <form className="mobile-map-search" onSubmit={handleSearchSubmit}>
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value)
            setSearchStatus('idle')
          }}
          placeholder="Find in the sky — try “jupiter” or “what's in the north”"
          aria-label="Search the sky map"
        />
        <button type="submit">Find</button>
        {searchStatus === 'not-found' && <p className="mobile-map-search-status">Nothing matching that is visible right now.</p>}
      </form>

      <div className="mobile-map-overlay-body">
        <div className="mobile-map-aim-readout">
          <span>Phone is pointing at</span>
          <strong>{pointingTitle}</strong>
          <small>{pointedObject ? `${pointedObject.compassLabel} · ${Math.round(pointedObject.altitudeDeg)}° alt` : pointingDetail}</small>
        </div>
        <SkyMapCanvas
          clarity={renderedClarity}
          date={mapDate}
          lat={lat}
          lon={lon}
          markerLabel={targetLabel}
          markerPosition={targetPosition}
          selectedObjectId={selectedObjectId}
          pointing={activePointing}
          presentation="full"
          onObjectSelect={toggleSelectedObject}
        />
      </div>

      <div className="mobile-map-time-control">
        <div>
          <span>Sky time</span>
          <strong>{formatMapTime(mapDate)}</strong>
        </div>
        <input
          type="range"
          min="0"
          max="1439"
          step="10"
          value={timeMinutes}
          onChange={(event) => setTimeMinutes(Number(event.currentTarget.value))}
          aria-label="Preview sky time"
        />
      </div>

      <div className="mobile-map-object-sheet">
        <div>
          <span>Selected target</span>
          <strong>{activeTitle}</strong>
        </div>
        {selectedObject ? (
          <>
            <dl className="mobile-map-object-facts">
              <div>
                <dt>Type</dt>
                <dd>{objectTypeLabel(selectedObject)}</dd>
              </div>
              <div>
                <dt>Direction</dt>
                <dd>{selectedObject.compassLabel} · {Math.round(selectedObject.altitudeDeg)}° alt</dd>
              </div>
              {formatOptionalNumber(selectedObject.magnitude) && (
                <div>
                  <dt>Brightness</dt>
                  <dd title={`Technical reference: magnitude ${formatOptionalNumber(selectedObject.magnitude)}`}>
                    {brightnessLabel(selectedObject.magnitude)}
                  </dd>
                </div>
              )}
              {selectedObject.constellation && (
                <div>
                  <dt>Constellation</dt>
                  <dd>{selectedObject.constellation}</dd>
                </div>
              )}
              {selectedObject.phaseLabel && (
                <div>
                  <dt>Phase</dt>
                  <dd>{selectedObject.phaseLabel}</dd>
                </div>
              )}
              {formatOptionalNumber(selectedObject.angularSizeDeg, '°') && (
                <div>
                  <dt>Size</dt>
                  <dd>{formatOptionalNumber(selectedObject.angularSizeDeg, '°')}</dd>
                </div>
              )}
            </dl>
            {selectedObject.sourceUrl && (
              <a className="mobile-map-source-link" href={selectedObject.sourceUrl} target="_blank" rel="noreferrer">
                {selectedObject.sourceLabel ?? 'Open source'}
              </a>
            )}
            <button type="button" className="mobile-map-reset-button" onClick={() => setSelectedObjectId(null)}>
              Reset view
            </button>
          </>
        ) : (
          <>
            <p>{targetSummary(targetPosition)}</p>
            <p>{pointedObject ? `Phone aim: ${pointedObject.name}` : guidance(activePointing, targetPosition)}</p>
          </>
        )}
        {compassStatus !== 'active' && (
          <button type="button" onClick={onEnableCompass} disabled={compassStatus === 'unsupported'}>
            {compassStatus === 'unsupported' ? 'Compass unavailable' : compassStatus === 'denied' ? 'Permission denied' : 'Enable compass'}
          </button>
        )}
      </div>

      <div className="mobile-map-visible-rail" aria-label="Visible objects">
        {visibleObjects.map((object) => (
          <button
            type="button"
            key={object.id}
            className={`mobile-map-visible-pill mobile-map-visible-pill--${object.kind}${selectedObjectId === object.id ? ' is-active' : ''}`}
            onClick={() => toggleSelectedObject(object)}
          >
            <span>{object.kind.replace('_', ' ')}</span>
            <strong>{object.name}</strong>
            <small>
              {object.compassLabel} · {Math.round(object.altitudeDeg)}°
            </small>
          </button>
        ))}
      </div>

      <div className="mobile-map-overlay-foot">
        <span>{cityName}</span>
        <span>{clarity == null ? 'Cloud forecast unavailable' : `${Math.round(clarity)}% clear`}</span>
        <span>{compassStatus === 'active' ? 'Compass live' : 'Compass off'}</span>
      </div>
    </div>
  )
}
