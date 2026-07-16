import { useMemo, useState } from 'react'
import { SkyMapCanvas } from './SkyMapCanvas'
import { turnInstruction, type DevicePointing } from '../lib/deviceCompass'
import { getSkyMapObjects, type SkyMapObject } from '../lib/skyMapLayers'
import type { HorizontalPosition } from '../lib/skyPosition'

interface SkyMapOverlayProps {
  cityName: string
  clarity: number
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
  const activePointing = compassStatus === 'active' ? pointing : null
  const [timeMinutes, setTimeMinutes] = useState(() => minutesSinceMidnight(new Date()))
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)
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
  const activeTitle = selectedObject?.name ?? targetLabel ?? 'Visible sky'

  function toggleSelectedObject(object: SkyMapObject) {
    setSelectedObjectId((current) => (current === object.id ? null : object.id))
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

      <div className="mobile-map-overlay-body">
        <SkyMapCanvas
          clarity={clarity}
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
                  <dt>Mag</dt>
                  <dd>{formatOptionalNumber(selectedObject.magnitude)}</dd>
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
            <p>{guidance(activePointing, targetPosition)}</p>
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
        <span>{Math.round(clarity)}% clear</span>
        <span>{compassStatus === 'active' ? 'Compass live' : 'Compass off'}</span>
      </div>
    </div>
  )
}
