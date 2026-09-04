import { useEffect, useState } from 'react'
import { MobileIcon, type MobileIconName } from '../components/mobile/MobileIcon'
import { StatGrid } from '../components/mobile/StatGrid'
import { EntryDetailView, type EntryDetailActions, type QuickActionOutcome } from '../views/mobile/EntryDetailView'
import { getTonightPlan } from '../lib/tonightTargets'
import { tonightRatingLabel } from '../lib/tonightScore'
import { buildEventDetail, detailInputFromTonightTarget, type EntryDetailSubject } from '../lib/entryDetail'
import { getEventsInRange, pullSkyEvents } from '../lib/sync'
import { addToWatchlist, getWatchlist, isWatching, matchesWatchlist, removeFromWatchlist, type WatchlistItem } from '../lib/watchlist'
import { addGetReadyReminder, ensureNotificationPermission, listGetReadyReminders } from '../lib/getReadyReminders'
import { ensurePushSubscription, queueWatchConfirmation } from '../lib/push'
import { categoryForKind } from '../lib/eventCategories'
import { CAMERA_PROFILES, getDefaultDevice } from '../lib/cameraProfiles'
import { listDiscoveries, type Discovery } from '../lib/discoveries'
import { getSignedUpEventsDueSoon } from '../lib/eventTags'
import { SignedUpEventsWidget } from '../widgets/SignedUpEventsWidget'
import {
  citizenScienceBadgesFromObservations,
  nextTierProgress,
  projectForEventKind,
  PROJECT_LABELS,
  type CitizenScienceBadge,
} from '../lib/citizenScienceBadges'
import { db } from '../lib/db'
import { useAuth } from '../lib/auth'
import { useThemeState } from '../lib/theme'
import { trackEvent } from '../lib/analytics'
import type { CurrentLocation } from '../lib/currentLocation'
import type { ObservationDraft } from '../lib/observationDraft'
import type { ObservationLogEntry, SkyEvent } from '../lib/db'
import type { TonightPlan } from '../lib/tonightTargets'

const LOCAL_USER_ID = 'local'

export interface HubPageProps {
  city: CurrentLocation
  onLogAttempt: (draft: ObservationDraft) => void
}

export function HubPage({ city, onLogAttempt }: HubPageProps) {
  const [theme] = useThemeState()
  const { user } = useAuth()
  const [plan, setPlan] = useState<TonightPlan | null>(null)
  const [events, setEvents] = useState<SkyEvent[]>([])
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [recentEntries, setRecentEntries] = useState<ObservationLogEntry[]>([])
  const [topDiscovery, setTopDiscovery] = useState<Discovery | null>(null)
  const [reminders, setReminders] = useState(() => listGetReadyReminders())
  const [entryDetail, setEntryDetail] = useState<{ subject: EntryDetailSubject; actions: EntryDetailActions } | null>(null)
  const [campaignsDueSoon, setCampaignsDueSoon] = useState<SkyEvent[]>([])
  const [citizenScienceBadges, setCitizenScienceBadges] = useState<CitizenScienceBadge[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      await pullSkyEvents()
      const now = new Date()
      const end = new Date(now.getTime() + 14 * 86_400_000)
      const [tonightPlan, upcoming, watched] = await Promise.all([
        getTonightPlan(city.lat, city.lon, now, city.timeZone),
        getEventsInRange(now, end),
        getWatchlist(),
      ])
      if (cancelled) return
      setPlan(tonightPlan)
      setEvents(upcoming)
      setWatchlist(watched)

      const scopeId = user?.id ?? LOCAL_USER_ID
      const entries = await db.observations.where('userId').equals(scopeId).reverse().sortBy('observedAt')
      if (!cancelled) {
        setRecentEntries(entries.filter((e) => e.photo).slice(0, 3))
        setCitizenScienceBadges(citizenScienceBadgesFromObservations(entries))
      }

      // Signed-up campaigns that are ongoing or starting within 48h -- the
      // only reason a tagged event needs a Hub slot at all, per eventTags.ts.
      const dueSoon = await getSignedUpEventsDueSoon(now)
      const dueSoonCampaigns = dueSoon.filter((e) => categoryForKind(e.kind)?.id === 'citizen-science')
      if (!cancelled) setCampaignsDueSoon(dueSoonCampaigns)

      try {
        const discoveries = await listDiscoveries()
        const weekAgo = Date.now() - 7 * 86_400_000
        const best = discoveries.filter((d) => new Date(d.created).getTime() >= weekAgo).sort((a, b) => b.voteCount - a.voteCount)[0]
        if (!cancelled) setTopDiscovery(best ?? null)
      } catch {
        // Community feed is best-effort context on Hub -- never blocks the page.
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [city.lat, city.lon, city.timeZone, user?.id])

  async function toggleWatch(target: string): Promise<QuickActionOutcome> {
    if (!user?.entitled) {
      trackEvent('Blocked free plan add', { action: 'watch', source: 'mobile_hub' })
      return { watching: false, message: 'Sky Pass is required to add events to a plan. Browsing and check-ins stay free.' }
    }
    const nowWatching = !isWatching(watchlist, 'target', target)
    if (nowWatching) {
      await addToWatchlist('target', target)
      let message = 'Watching. Atlas will notify you about good viewing windows.'
      try {
        const pushReady = await ensurePushSubscription()
        const confirmed = pushReady ? await queueWatchConfirmation({ id: target, title: target }) : false
        if (confirmed) message = 'Watching. A confirmation notification is queued.'
        else if (!pushReady) message = 'Watching saved, but push is not enabled. Enable it in Profile to receive notifications.'
      } catch {
        message = 'Watching saved, but push setup needs attention in Profile.'
      }
      setWatchlist(await getWatchlist())
      return { watching: true, message }
    }
    await removeFromWatchlist('target', target)
    setWatchlist(await getWatchlist())
    return { watching: false, message: 'Removed from your watchlist.' }
  }

  async function addReminder(event: SkyEvent): Promise<QuickActionOutcome> {
    const hasPermission = await ensureNotificationPermission()
    await addGetReadyReminder({
      eventId: event.id,
      title: event.title,
      kind: event.kind,
      target: event.target,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      deviceName: CAMERA_PROFILES[getDefaultDevice()].name,
      lat: city.lat,
      lon: city.lon,
    })
    setReminders(listGetReadyReminders())
    trackEvent('Added get ready reminder', { target: event.title, hasPermission, source: 'mobile_hub' })
    return { reminderActive: true, message: hasPermission ? 'Reminder armed.' : 'Saved in Atlas. Browser notifications are not enabled.' }
  }

  function openEventDetail(event: SkyEvent) {
    if (!plan) return
    const target = plan.targets.find((t) => t.eventId === event.id) ?? syntheticTarget(event)
    const subject = buildEventDetail(detailInputFromTonightTarget(target, plan.moonIlluminationPct, plan.darknessWindow, event, city), plan.todayAdvisory)
    openSubject(subject, event)
  }

  function openHeroTarget() {
    if (!plan || plan.targets.length === 0) return
    const target = plan.targets[0]
    const sourceEvent = events.find((e) => e.id === target.eventId)
    const subject = buildEventDetail(detailInputFromTonightTarget(target, plan.moonIlluminationPct, plan.darknessWindow, sourceEvent, city), plan.todayAdvisory)
    openSubject(subject, sourceEvent)
  }

  function openSubject(subject: EntryDetailSubject, sourceEvent?: SkyEvent) {
    const reminder = sourceEvent ? reminders.find((r) => r.eventId === sourceEvent.id) : undefined
    setEntryDetail({
      subject,
      actions: {
        watching: subject.sourceEvent ? isWatching(watchlist, 'target', subject.sourceEvent.target) : false,
        onToggleWatch: subject.sourceEvent ? () => toggleWatch(subject.sourceEvent!.target) : undefined,
        reminderActive: !!reminder,
        onRemind: sourceEvent ? () => addReminder(sourceEvent) : undefined,
      },
    })
  }

  function syntheticTarget(event: SkyEvent) {
    return {
      eventId: event.id,
      title: event.title,
      kind: event.kind,
      bestTime: event.startsAt,
      difficulty: 'moderate' as const,
      phoneFriendly: false,
      nakedEyeVisible: true,
      reason: event.content || event.description || '',
      viewingNote: '',
      direction: null,
    }
  }

  function submitCampaign(event: SkyEvent) {
    const project = projectForEventKind(event.kind)
    onLogAttempt({
      eventId: event.id,
      targetName: event.title,
      locationLabel: city.name,
      latitude: city.lat,
      longitude: city.lon,
      ...(project ? { citizenScienceProject: project } : {}),
    })
  }

  function logEntryDetailAttempt() {
    if (!entryDetail) return
    const { subject } = entryDetail
    onLogAttempt({
      eventId: subject.id,
      targetName: subject.title,
      deviceUsed: CAMERA_PROFILES[getDefaultDevice()].name,
      cameraRecipeUsed: subject.recipeKey ?? undefined,
      locationLabel: city.name,
      moonIlluminationPct: subject.moonPct ?? undefined,
      directionLabel: subject.direction?.compassLabel,
    })
    setEntryDetail(null)
  }

  const watchRows = plan ? events.filter((e) => matchesWatchlist(e, watchlist)).slice(0, 5) : []
  const spaceWeatherEvent = events.find((e) => e.kind === 'aurora' || e.kind === 'solar_flare')
  const now = new Date()

  return (
    <div className="az-page">
      <p className="az-kicker">
        {now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} · after dark
      </p>
      <h1 className="az-h1">{plan ? headlineFor(plan) : 'Loading tonight…'}</h1>
      {plan?.todayAdvisory && (
        <p className="az-hero-title">
          {Math.round(100 - plan.todayAdvisory.cloudCoverPct)}% clear skies expected. Dark window{' '}
          {timeLabel(plan.darknessWindow.astronomicalDuskAt ?? plan.darknessWindow.civilDuskAt)}–
          {timeLabel(plan.darknessWindow.astronomicalDawnAt ?? plan.darknessWindow.civilDawnAt)}.
        </p>
      )}

      {plan && (
        <div style={{ marginTop: '1.125rem' }}>
          <StatGrid
            stats={[
              { value: tonightRatingLabel(plan.rating), label: 'TONIGHT' },
              { value: plan.todayAdvisory ? `${Math.round(100 - plan.todayAdvisory.cloudCoverPct)}%` : '—', label: 'CLEAR' },
              { value: `${Math.round(plan.moonIlluminationPct)}%`, label: 'MOON' },
              { value: String(plan.targets.length), label: 'TARGETS' },
            ]}
          />
        </div>
      )}

      {plan && plan.targets.length > 0 && (
        <>
          <div className="az-section-head">
            <span className="az-kicker">Highlight tonight</span>
            <span style={{ font: '500 0.6875rem var(--az-font-mono)', color: 'var(--az-flagship)' }}>
              {timeLabel(plan.targets[0].bestTime)}
            </span>
          </div>
          <button type="button" className="az-card" style={{ width: '100%', textAlign: 'left', cursor: 'pointer', border: '1px solid var(--line)' }} onClick={openHeroTarget}>
            <div className="az-hero-media">EVENT IMAGERY</div>
            <div className="az-card-body">
              <span className="az-kicker" style={{ color: 'var(--az-violet-strong)' }}>
                {categoryForKind(plan.targets[0].kind)?.label.toUpperCase() ?? plan.targets[0].kind}
              </span>
              <strong style={{ display: 'block', fontFamily: 'var(--az-font-display)', fontSize: '1.25rem', margin: '0.25rem 0 0.3125rem' }}>
                {plan.targets[0].title}
              </strong>
              <p className="az-muted" style={{ margin: 0, fontSize: '0.84375rem' }}>{plan.targets[0].viewingNote || plan.targets[0].reason}</p>
            </div>
          </button>
        </>
      )}

      {watchRows.length > 0 && (
        <>
          <div className="az-section-head">
            <span className="az-kicker">On your watchlist</span>
          </div>
          <div className="az-row-group">
            {watchRows.map((event) => (
              <button type="button" key={event.id} className="az-row" onClick={() => openEventDetail(event)}>
                <span className="az-row-icon">
                  <MobileIcon name={(categoryForKind(event.kind)?.icon as MobileIconName) ?? 'zap'} />
                </span>
                <span className="az-row-main">
                  <span className="az-row-kind">{categoryForKind(event.kind)?.label.toUpperCase() ?? event.kind} · WATCHING</span>
                  <span className="az-row-title">{event.title}</span>
                </span>
                <span className="az-row-trail">
                  <span className="az-row-time">{new Date(event.startsAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                  <span className="az-row-note">{reminders.some((r) => r.eventId === event.id) ? 'reminder armed' : ''}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {campaignsDueSoon.length > 0 && (
        <>
          <div className="az-section-head">
            <span className="az-kicker">Citizen science — due now</span>
          </div>
          <SignedUpEventsWidget events={campaignsDueSoon} onSubmit={submitCampaign} />
        </>
      )}

      {citizenScienceBadges.length > 0 && (
        <>
          <div className="az-section-head">
            <span className="az-kicker">Your contributions</span>
          </div>
          <div className="az-row-group">
            {citizenScienceBadges.map((badge) => {
              const progress = nextTierProgress(badge.count)
              return (
                <div key={badge.project} className="az-card-body" style={{ background: 'var(--surface)' }}>
                  <strong style={{ display: 'block', fontSize: '0.90625rem', fontWeight: 500 }}>
                    {PROJECT_LABELS[badge.project] ?? badge.project}
                  </strong>
                  <p className="az-muted" style={{ margin: '0.1875rem 0 0', fontSize: '0.78125rem' }}>
                    {badge.count} submission{badge.count === 1 ? '' : 's'}
                    {badge.tier ? ` · ${badge.tier[0].toUpperCase()}${badge.tier.slice(1)} badge` : ''}
                    {progress ? ` · ${progress.remaining} more for ${progress.tier}` : ' · top tier reached'}
                  </p>
                </div>
              )
            })}
          </div>
        </>
      )}

      {recentEntries.length > 0 && (
        <>
          <div className="az-section-head">
            <span className="az-kicker">Your recent frames</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5625rem', overflowX: 'auto', paddingBottom: '4px' }}>
            {recentEntries.map((entry) => (
              <div key={entry.id} className="az-card" style={{ flex: 'none', width: '7.375rem' }}>
                <div className="az-thumb-lg" style={{ height: '6rem' }}>
                  PHOTO
                </div>
                <div style={{ padding: '0.4375rem 0.5625rem 0.5rem' }}>
                  <span style={{ display: 'block', fontWeight: 500, fontSize: '0.75rem', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {entry.targetName ?? 'Observation'}
                  </span>
                  <span className="az-muted" style={{ display: 'block', font: '500 0.59375rem var(--az-font-mono)' }}>
                    {new Date(entry.observedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }).toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {(spaceWeatherEvent || topDiscovery) && (
        <>
          <div className="az-section-head">
            <span className="az-kicker">Sky dispatch</span>
          </div>
          <div className="az-row-group">
            {spaceWeatherEvent && (
              <div className="az-card-body" style={{ background: 'var(--surface)' }}>
                <span className="az-pill" style={{ '--pill-hue': 70 } as React.CSSProperties}>
                  SPACE WEATHER
                </span>
                <strong style={{ display: 'block', fontSize: '0.90625rem', fontWeight: 500, margin: '0.1875rem 0' }}>{spaceWeatherEvent.title}</strong>
                <p className="az-muted" style={{ margin: 0, fontSize: '0.78125rem' }}>{spaceWeatherEvent.content || spaceWeatherEvent.description}</p>
              </div>
            )}
            {topDiscovery && (
              <div className="az-card-body" style={{ background: 'var(--surface)' }}>
                <span className="az-pill" style={{ '--pill-hue': 288 } as React.CSSProperties}>
                  COMMUNITY
                </span>
                <strong style={{ display: 'block', fontSize: '0.90625rem', fontWeight: 500, margin: '0.1875rem 0' }}>
                  {topDiscovery.voteCount} vote{topDiscovery.voteCount === 1 ? '' : 's'} for {topDiscovery.authorName}'s {topDiscovery.target ?? 'sighting'}
                </strong>
                <p className="az-muted" style={{ margin: 0, fontSize: '0.78125rem' }}>{topDiscovery.caption}</p>
              </div>
            )}
          </div>
        </>
      )}

      {entryDetail && (
        <EntryDetailView
          subject={entryDetail.subject}
          actions={entryDetail.actions}
          onClose={() => setEntryDetail(null)}
          onLogAttempt={logEntryDetailAttempt}
          dark={theme === 'dark'}
        />
      )}
    </div>
  )
}

function headlineFor(plan: TonightPlan): string {
  if (plan.rating === 'great' || plan.rating === 'good') return 'Good night for it.'
  if (plan.rating === 'maybe') return "Worth a look tonight."
  if (plan.rating === 'poor') return 'Slim chances tonight.'
  return 'Skip it tonight.'
}

function timeLabel(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
}
