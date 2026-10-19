import { useEffect, useMemo, useRef, useState } from 'react'
import { Sheet } from './Sheet'
import { PaywallGate } from '../PaywallGate'
import { LocationSearchInput } from '../LocationSearchInput'
import { extractPhotoExif } from '../../lib/exifExtract'
import { identifySky, type SkyPhotoIdResult } from '../../lib/skyPhotoId'
import { cityLabel, type City } from '../../lib/cities'
import { useAuth } from '../../lib/auth'
import { trackEvent } from '../../lib/analytics'
import type { CurrentLocation } from '../../lib/currentLocation'
import { FormSurface } from '../forms/FormSurface'
import { FormStatus } from '../forms/FormStatus'
import { useDirtyFormRegistration } from '../../lib/dirtyForms'

export interface PhotoSkyIdSheetProps {
  open: boolean
  onClose: () => void
  currentLocation: CurrentLocation
  onSignInClick: () => void
}

const PHOTO_ID_DRAFT_KEY_PREFIX = 'atlas-photo-sky-id-draft-v1:'

interface PhotoSkyIdDraft {
  whenLocal: string
  manualCityQuery: string
  lat: number | null
  lon: number | null
  headingDeg: number | null
  timeZoneKnown: boolean
}

function readPhotoSkyIdDraft(key: string): PhotoSkyIdDraft | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PhotoSkyIdDraft>
    if (typeof parsed.whenLocal !== 'string' || typeof parsed.manualCityQuery !== 'string') return null
    const asNumber = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null)
    return {
      whenLocal: parsed.whenLocal,
      manualCityQuery: parsed.manualCityQuery,
      lat: asNumber(parsed.lat),
      lon: asNumber(parsed.lon),
      headingDeg: asNumber(parsed.headingDeg),
      timeZoneKnown: parsed.timeZoneKnown !== false,
    }
  } catch {
    return null
  }
}

function writePhotoSkyIdDraft(key: string, draft: PhotoSkyIdDraft) {
  try {
    window.localStorage.setItem(key, JSON.stringify(draft))
  } catch {
    // Storage can be unavailable (private mode); keep the in-memory state.
  }
}

function clearPhotoSkyIdDraft(key: string) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Nothing to clear when storage is unavailable.
  }
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
  const draftStorageKey = useMemo(() => `${PHOTO_ID_DRAFT_KEY_PREFIX}${user?.id ?? 'local'}`, [user?.id])
  const identifyLockedRef = useRef(false)
  const [photo, setPhoto] = useState<File | null>(null)
  const [reading, setReading] = useState(false)
  const [identifying, setIdentifying] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [timeZoneKnown, setTimeZoneKnown] = useState(true)
  const [headingDeg, setHeadingDeg] = useState<number | null>(null)
  const [whenLocal, setWhenLocal] = useState('')
  const [manualCity, setManualCity] = useState<City | null>(null)
  const [manualCityQuery, setManualCityQuery] = useState('')
  const [lat, setLat] = useState<number | null>(null)
  const [lon, setLon] = useState<number | null>(null)
  const [result, setResult] = useState<SkyPhotoIdResult | null>(null)
  const busy = reading || identifying
  const dirty =
    photo != null || whenLocal !== '' || manualCityQuery.trim() !== '' || lat != null || lon != null || result != null || headingDeg != null

  useDirtyFormRegistration(`photo-sky-id-sheet:${user?.id ?? 'local'}`, open && dirty)

  useEffect(() => {
    if (!open) return
    const persisted = readPhotoSkyIdDraft(draftStorageKey)
    setPhoto(null)
    setReading(false)
    setIdentifying(false)
    setStatusMessage(null)
    setTimeZoneKnown(persisted?.timeZoneKnown ?? true)
    setHeadingDeg(persisted?.headingDeg ?? null)
    setWhenLocal(persisted?.whenLocal ?? '')
    setManualCity(null)
    setManualCityQuery(persisted?.manualCityQuery ?? '')
    setLat(persisted?.lat ?? null)
    setLon(persisted?.lon ?? null)
    setResult(null)
  }, [open, draftStorageKey])

  useEffect(() => {
    if (!open) return
    const hasDraft = whenLocal !== '' || manualCityQuery.trim() !== '' || lat != null || lon != null || headingDeg != null
    if (!hasDraft) {
      clearPhotoSkyIdDraft(draftStorageKey)
      return
    }
    writePhotoSkyIdDraft(draftStorageKey, {
      whenLocal,
      manualCityQuery,
      lat,
      lon,
      headingDeg,
      timeZoneKnown,
    })
  }, [open, draftStorageKey, whenLocal, manualCityQuery, lat, lon, headingDeg, timeZoneKnown])

  function handleClose() {
    if (!dirty) {
      onClose()
      return
    }
    if (!window.confirm('Discard this draft?')) return
    clearPhotoSkyIdDraft(draftStorageKey)
    onClose()
  }

  async function handlePhoto(file: File | null) {
    setPhoto(file)
    setResult(null)
    setStatusMessage(null)
    if (!file) return
    setReading(true)
    trackEvent('photo_sky_id_started', { hasFile: true })
    try {
      const exif = await extractPhotoExif(file)

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
    } catch {
      setStatusMessage('This photo metadata could not be read. Try another original image.')
    } finally {
      setReading(false)
    }
  }

  async function handleIdentify() {
    if (lat == null || lon == null || !whenLocal || identifyLockedRef.current) return
    identifyLockedRef.current = true
    setIdentifying(true)
    setStatusMessage(null)
    try {
      const date = new Date(whenLocal)
      const computed = identifySky({ date, lat, lon, headingDeg: headingDeg ?? undefined })
      setResult(computed)
      trackEvent('photo_sky_id_succeeded', {
        objectCount: computed.objects.length,
        hasConjunction: computed.closestPair != null,
        timeZoneKnown,
        hadHeading: headingDeg != null,
      })
    } catch {
      setStatusMessage("We couldn't identify this frame yet. Check the date, place and heading, then try again.")
    } finally {
      identifyLockedRef.current = false
      setIdentifying(false)
    }
  }

  const canIdentify = photo != null && lat != null && lon != null && whenLocal !== ''

  return (
    <Sheet open={open} title="What's in this photo?" onClose={handleClose}>
      <PaywallGate
        user={user}
        feature="photo_sky_id"
        description="Upload a sky photo and Atlas reads its time, GPS and heading to tell you exactly what you were looking at."
        onSignInClick={onSignInClick}
        freeBullets="Tonight, 14-day event browsing, tonight’s check-ins, and your private journal."
        paidBullets="Backdated check-ins, photo sky ID, 90-day plans, saved targets, reminders, dark sites, and the rest of Sky Pass."
      >
        <FormSurface
          as="div"
          footer={
            photo && !reading ? (
              <button
                type="button"
                className="az-btn az-btn-primary az-btn-block az-btn-stable"
                onClick={() => void handleIdentify()}
                disabled={!canIdentify || busy}
                aria-busy={busy}
              >
                <span className="az-btn-label">Identify what's in frame</span>
                <span className={`az-btn-spinner${busy ? ' is-visible' : ''}`} aria-hidden="true" />
              </button>
            ) : null
          }
        >
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

          <FormStatus message={statusMessage ?? (reading ? 'Reading photo metadata…' : null)} tone={statusMessage ? 'error' : 'neutral'} live={statusMessage ? 'assertive' : 'polite'} />
        </FormSurface>
      </PaywallGate>
    </Sheet>
  )
}
