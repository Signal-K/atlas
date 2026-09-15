import { useEffect, useState } from 'react'
import { Sheet } from './Sheet'
import { PaywallGate } from '../PaywallGate'
import { LocationSearchInput } from '../LocationSearchInput'
import { extractPhotoExif } from '../../lib/exifExtract'
import { identifySky, type SkyPhotoIdResult } from '../../lib/skyPhotoId'
import { cityLabel, type City } from '../../lib/cities'
import { useAuth } from '../../lib/auth'
import { trackEvent } from '../../lib/analytics'
import type { CurrentLocation } from '../../lib/currentLocation'

export interface PhotoSkyIdSheetProps {
  open: boolean
  onClose: () => void
  currentLocation: CurrentLocation
  onSignInClick: () => void
}

// Local input's own [-350, 350ish]-year Date-parsing edge cases don't matter
// here -- this only ever feeds a <input type="datetime-local"> value and
// reads it back, both within the same browser session.
function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// ASV-33: Premium "upload a sky photo, tell me what's in it" flow. EXIF
// time/GPS/heading -> astronomy-engine alt-az for the naked-eye bodies ->
// plain-language result, entirely client-side (see exifExtract.ts and
// skyPhotoId.ts for the two pieces of real logic this wires together).
export function PhotoSkyIdSheet({ open, onClose, currentLocation, onSignInClick }: PhotoSkyIdSheetProps) {
  const { user } = useAuth()
  const [photo, setPhoto] = useState<File | null>(null)
  const [reading, setReading] = useState(false)
  const [timeZoneKnown, setTimeZoneKnown] = useState(true)
  const [headingDeg, setHeadingDeg] = useState<number | null>(null)
  const [whenLocal, setWhenLocal] = useState('')
  const [manualCity, setManualCity] = useState<City | null>(null)
  const [manualCityQuery, setManualCityQuery] = useState('')
  const [lat, setLat] = useState<number | null>(null)
  const [lon, setLon] = useState<number | null>(null)
  const [result, setResult] = useState<SkyPhotoIdResult | null>(null)

  useEffect(() => {
    if (!open) return
    setPhoto(null)
    setReading(false)
    setTimeZoneKnown(true)
    setHeadingDeg(null)
    setWhenLocal('')
    setManualCity(null)
    setManualCityQuery('')
    setLat(null)
    setLon(null)
    setResult(null)
  }, [open])

  async function handlePhoto(file: File | null) {
    setPhoto(file)
    setResult(null)
    if (!file) return
    setReading(true)
    trackEvent('photo_sky_id_started', { hasFile: true })
    const exif = await extractPhotoExif(file)
    setReading(false)

    const when = exif.dateTimeOriginal ?? new Date()
    setWhenLocal(toDatetimeLocalValue(when))
    setTimeZoneKnown(exif.dateTimeOriginal != null && exif.timeZoneKnown)
    setHeadingDeg(exif.headingDeg)

    if (exif.lat != null && exif.lon != null) {
      setLat(exif.lat)
      setLon(exif.lon)
    } else {
      // No GPS in the photo -- fall back to the person's current Atlas
      // location as a starting point rather than leaving the fields blank;
      // still fully editable via the city search below.
      setLat(currentLocation.lat)
      setLon(currentLocation.lon)
      setManualCityQuery(currentLocation.name)
    }

    if (exif.dateTimeOriginal == null || exif.lat == null) {
      trackEvent('photo_sky_id_missing_exif', { hasTime: exif.dateTimeOriginal != null, hasGps: exif.lat != null })
    }
  }

  function handleIdentify() {
    if (lat == null || lon == null || !whenLocal) return
    const date = new Date(whenLocal)
    const computed = identifySky({ date, lat, lon, headingDeg: headingDeg ?? undefined })
    setResult(computed)
    trackEvent('photo_sky_id_succeeded', {
      objectCount: computed.objects.length,
      hasConjunction: computed.closestPair != null,
      timeZoneKnown,
      hadHeading: headingDeg != null,
    })
  }

  const canIdentify = photo != null && lat != null && lon != null && whenLocal !== ''

  return (
    <Sheet open={open} title="What's in this photo?" onClose={onClose}>
      <PaywallGate
        user={user}
        feature="photo_sky_id"
        description="Upload a sky photo and Atlas reads its time, GPS and heading to tell you exactly what you were looking at."
        onSignInClick={onSignInClick}
        freeBullets="Tonight, 14-day event browsing, check-ins, and your private journal."
        paidBullets="Photo sky ID, 90-day plans, saved targets, reminders, dark sites, and the rest of Sky Pass."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <p className="az-muted" style={{ margin: 0, fontSize: '0.8125rem' }}>
            Works best on the original photo (not a screenshot) so its time, GPS and compass heading survive. Nothing
            leaves your device — the photo and its metadata are read locally, not uploaded.
          </p>

          <label
            className="az-btn az-btn-outline az-btn-block"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            htmlFor="photo-sky-id-file"
          >
            {photo ? photo.name : 'Choose a sky photo'}
          </label>
          <input
            id="photo-sky-id-file"
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => void handlePhoto(event.target.files?.[0] ?? null)}
          />

          {reading && <p className="az-muted" style={{ margin: 0, fontSize: '0.8125rem' }}>Reading photo metadata…</p>}

          {photo && !reading && (
            <>
              <div>
                <span className="az-kicker">When was it taken?</span>
                {!timeZoneKnown && (
                  <p className="az-muted" style={{ margin: '0.25rem 0 0', fontSize: '0.75rem' }}>
                    This photo didn't record a timezone — check this is right before identifying.
                  </p>
                )}
                <input
                  type="datetime-local"
                  value={whenLocal}
                  onChange={(event) => setWhenLocal(event.target.value)}
                  style={{ marginTop: '0.4375rem' }}
                />
              </div>

              <div>
                <span className="az-kicker">Where was it taken?</span>
                {lat != null && lon != null && !manualCityQuery && (
                  <p className="az-muted" style={{ margin: '0.25rem 0 0.4375rem', fontSize: '0.75rem' }}>
                    Using the photo's GPS: {lat.toFixed(3)}, {lon.toFixed(3)}
                  </p>
                )}
                <LocationSearchInput
                  id="photo-sky-id-location"
                  value={manualCityQuery}
                  onChange={setManualCityQuery}
                  onSelect={(city) => {
                    setManualCity(city)
                    setManualCityQuery(cityLabel(city))
                    setLat(city.lat)
                    setLon(city.lon)
                  }}
                  placeholder="Search city if the GPS looks wrong"
                />
                {manualCity && <input type="hidden" value={manualCity.name} readOnly />}
              </div>

              <button type="button" className="az-btn az-btn-primary az-btn-block" onClick={handleIdentify} disabled={!canIdentify}>
                Identify what's in frame
              </button>
            </>
          )}

          {result && (
            <div style={{ background: 'var(--chip)', borderRadius: '0.75rem', padding: '0.75rem 0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9375rem' }}>{result.summary}</p>
              {result.objects.length > 0 && (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {result.objects.map((object) => (
                    <li key={object.target} style={{ fontSize: '0.8125rem', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{object.name}</span>
                      <span className="az-muted">{Math.round(object.altitudeDeg)}° {object.compassLabel}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </PaywallGate>
    </Sheet>
  )
}
