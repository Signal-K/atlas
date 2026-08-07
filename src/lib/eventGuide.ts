// Step-by-step "how to see it" guide for the highest-stakes events (a solar
// eclipse or meteor shower peak is a once-a-year-or-rarer window, so a
// generic per-kind camera recipe isn't enough) -- computed from the actual
// event, the viewer's real location, and local time, not boilerplate.
import type { SkyEvent } from './db'
import { localSolarEclipseCircumstances } from './eclipseCircumstances'
import { moonIlluminationPctAt } from './moonPhase'
import { rankDarkSkySites } from './darkSky'

export interface GuideStep {
  label: string
  detail: string
}

interface GuideLocation {
  lat: number
  lon: number
  name: string
  timeZone?: string
}

function formatLocalTime(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  })
}

function eclipseKindLabel(kind: 'total' | 'annular' | 'partial'): string {
  if (kind === 'total') return 'total'
  if (kind === 'annular') return 'annular'
  return 'partial'
}

function buildEclipseGuide(event: SkyEvent, location: GuideLocation): GuideStep[] | null {
  if (event.target !== 'sun') return null
  const circumstances = localSolarEclipseCircumstances(event.startsAt, location.lat, location.lon)
  if (!circumstances) return null

  if (!circumstances.visible) {
    return [
      {
        label: `Not visible from ${location.name}`,
        detail: 'The Sun will be below the horizon here at the eclipse’s peak, so this eclipse won’t be observable from this location.',
      },
    ]
  }

  const steps: GuideStep[] = [
    {
      label: `What you'll see from ${location.name}`,
      detail:
        circumstances.kind === 'total'
          ? 'A total eclipse — the Moon fully covers the Sun here. Safe to view with the naked eye only during totality; use eclipse glasses for every other phase.'
          : `A ${eclipseKindLabel(circumstances.kind)} eclipse — about ${circumstances.obscurationPct}% of the Sun's disc will be covered at maximum. Eclipse glasses (or a solar filter) are required for the entire event.`,
    },
  ]

  if (circumstances.partialBeginsAt) {
    steps.push({ label: 'Partial phase begins', detail: formatLocalTime(circumstances.partialBeginsAt, location.timeZone) })
  }
  if (circumstances.totalBeginsAt) {
    steps.push({ label: `${circumstances.kind === 'total' ? 'Totality' : 'Annularity'} begins`, detail: formatLocalTime(circumstances.totalBeginsAt, location.timeZone) })
  }
  steps.push({ label: 'Maximum eclipse', detail: formatLocalTime(circumstances.peakAt, location.timeZone) })
  if (circumstances.totalEndsAt) {
    steps.push({ label: `${circumstances.kind === 'total' ? 'Totality' : 'Annularity'} ends`, detail: formatLocalTime(circumstances.totalEndsAt, location.timeZone) })
  }
  if (circumstances.partialEndsAt) {
    steps.push({ label: 'Partial phase ends', detail: formatLocalTime(circumstances.partialEndsAt, location.timeZone) })
  }

  steps.push({
    label: 'Get set up',
    detail: 'Find a spot with a clear view toward the Sun’s path, arrive 15-20 minutes before the partial phase starts, and have eclipse glasses ready before it begins — don’t look through a phone camera or unfiltered lens.',
  })

  return steps
}

function buildMeteorShowerGuide(event: SkyEvent, location: GuideLocation): GuideStep[] {
  const peakLocalTime = formatLocalTime(event.startsAt, location.timeZone)
  const moonPct = Math.round(moonIlluminationPctAt(new Date(event.startsAt)))
  const nearestSite = rankDarkSkySites(location.lat, location.lon, 1)[0]

  const steps: GuideStep[] = [
    { label: 'Peak window starts', detail: `${peakLocalTime} local time — rates build toward the pre-dawn hours.` },
    {
      label: 'Moon interference',
      detail:
        moonPct > 50
          ? `Moon is ${moonPct}% illuminated — its glow will wash out fainter meteors. Face away from it for the best view.`
          : `Moon is only ${moonPct}% illuminated — good dark-sky conditions for this shower.`,
    },
    {
      label: 'Get set up',
      detail: 'No equipment needed — this is a naked-eye event. Lie back or recline, face away from any light sources, and let your eyes adapt to the dark for 20-30 minutes before counting meteors.',
    },
  ]

  if (nearestSite) {
    steps.push({
      label: 'Best nearby dark sky',
      detail: `${nearestSite.name} (about ${Math.round(nearestSite.distanceKm)}km away, Bortle ${nearestSite.bortleClass}) if you can travel for a darker sky.`,
    })
  }

  return steps
}

export function buildEventGuide(event: SkyEvent, location: GuideLocation): GuideStep[] | null {
  if (event.kind === 'eclipse') return buildEclipseGuide(event, location)
  if (event.kind === 'meteor_shower') return buildMeteorShowerGuide(event, location)
  return null
}
