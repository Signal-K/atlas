import { useEffect, useMemo, useState } from 'react'
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
import { db } from '../lib/db'
import { useAuth } from '../lib/auth'
import { useThemeState } from '../lib/theme'
import { trackEvent } from '../lib/analytics'
import { dayGroupLabel, localDateKey } from '../lib/weather'
import type { CurrentLocation } from '../lib/currentLocation'
import type { ObservationDraft } from '../lib/observationDraft'
import type { ObservationLogEntry, SkyEvent } from '../lib/db'
import type { TonightPlan } from '../lib/tonightTargets'

const LOCAL_USER_ID = 'local'

// Filter-chip + day-grouped upcoming list, ported from the Claude Design
// "Minimal Atlas with events" mockup's FocusScreen -- replaces the old
// pre-filtered "On your watchlist" list with one feed that covers all four
// of the mockup's views (All/Tonight/This week/Watching) against the same
// 14-day window Hub already fetches for the tonight plan.
type HubFilterKey = 'all' | 'tonight' | 'week' | 'watching'
const HUB_FILTERS: Array<{ key: HubFilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'tonight', label: 'Tonight' },
  { key: 'week', label: 'This week' },
  { key: 'watching', label: 'Watching' },
]

export interface HubPageProps {
  city: CurrentLocation
  // Asks the browser for the device's location. Shown as a prompt while no
  // location is set, in place of a personal plan.
  onRequestLocation?: () => void
  onLogAttempt: (draft: ObservationDraft) => void
}

export function HubPage({ city, onLogAttempt, onRequestLocation }: HubPageProps) {
  const hasLocation = city.source !== 'default'
  const [theme] = useThemeState()
  const { user } = useAuth()
  const [plan, setPlan] = useState<TonightPlan | null>(null)
  const [events, setEvents] = useState<SkyEvent[]>([])
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [recentEntries, setRecentEntries] = useState<ObservationLogEntry[]>([])
  const [topDiscovery, setTopDiscovery] = useState<Discovery | null>(null)
  const [reminders, setReminders] = useState(() => listGetReadyReminders())
  const [entryDetail, setEntryDetail] = useState<{ subject: EntryDetailSubject; actions: EntryDetailActions } | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [retryTick, setRetryTick] = useState(0)
  const [upcomingFilter, setUpcomingFilter] = useState<HubFilterKey>('all')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadError(false)
      trackEvent('Tonight plan generation started', { source: 'mobile_hub' })
      try {
        // Stale-while-revalidate: whatever is already cached locally can fill
        // the Upcoming list straight away, instead of leaving the page on
        // "Loading tonight…" for the whole network round trip. The pull below
        // then refreshes it. A first-ever visit has an empty cache and simply
        // waits as before.
        const firstNow = new Date()
        const cached = await getEventsInRange(firstNow, new Date(firstNow.getTime() + 14 * 86_400_000))
        if (!cancelled && cached.length > 0) setEvents(cached)
        await pullSkyEvents()
        const now = new Date()
        const end = new Date(now.getTime() + 14 * 86_400_000)
        // With no location there is no "tonight over you" to compute -- and
        // computing one for a placeholder city would present someone else's
        // sky as theirs. Show the global event list only.
        if (!hasLocation) {
          const [upcoming, watched] = await Promise.all([getEventsInRange(now, end), getWatchlist()])
          if (cancelled) return
          setPlan(null)
          setEvents(upcoming)
          setWatchlist(watched)
          return
        }
        const [tonightPlan, upcoming, watched] = await Promise.all([
          getTonightPlan(city.lat, city.lon, now, city.timeZone),
          getEventsInRange(now, end),
          getWatchlist(),
        ])
        if (cancelled) return
        setPlan(tonightPlan)
        setEvents(upcoming)
        setWatchlist(watched)
        // Canonical Atlas "value moment" event (ASV-23): a Tonight plan
        // generated with a real location set. city/rating ride along so
        // funnels and insights can segment without a second lookup.
        const planProperties = {
          source: 'mobile_hub',
          targetCount: tonightPlan.targets.length,
          city: city.name,
          rating: tonightPlan.rating,
          hasLocation: city.source !== 'default',
        }
        trackEvent('Tonight plan generation succeeded', planProperties)
        // Alias kept for the PostHog replay event trigger, which is still
        // configured as "Generated tonight plan" (the pre-rebuild name).
        trackEvent('Generated tonight plan', planProperties)

        const scopeId = user?.id ?? LOCAL_USER_ID
        const entries = await db.observations.where('userId').equals(scopeId).reverse().sortBy('observedAt')
        if (!cancelled) setRecentEntries(entries.filter((e) => e.photo).slice(0, 3))
      } catch (err) {
        // Without this, a single rejected fetch (flaky signal, which is the
        // norm for this app's actual outdoor/nighttime use case) left the
        // page stuck on a bare "Loading tonight..." string forever, with no
        // error, no retry, and no analytics signal that it had happened.
        if (cancelled) return
        setLoadError(true)
        trackEvent('Tonight plan generation failed', { source: 'mobile_hub', error: String(err) })
        return
      }

      try {
        const discoveries = await listDiscoveries()
        const weekAgo = Date.now() - 7 * 86_400_000
        const best = discoveries.filter((d) => new Date(d.created).getTime() >= weekAgo).sort((a, b) => b.voteCount - a.voteCount)[0]
        if (!cancelled) setTopDiscovery(best ?? null)
      } catch (err) {
        if (!cancelled) trackEvent('sync_failed', { stage: 'community_feed_discoveries', error: String(err) })
        // Community feed is best-effort context on Hub -- never blocks the page.
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // city.name/city.source are read only inside the analytics call and
    // always change in lockstep with city.lat/lon (same CurrentLocation
    // object) -- depending on them too would just duplicate this effect's
    // existing re-run trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city.lat, city.lon, city.timeZone, hasLocation, user?.id, retryTick])

  async function toggleWatch(target: string): Promise<QuickActionOutcome> {
    if (!user?.entitled) {
      trackEvent('Blocked free plan add', { action: 'watch', source: 'mobile_hub' })
      return { watching: false, message: 'Sky Pass is required to add events to a plan. Browsing and tonight’s check-ins stay free.' }
    }
    const nowWatching = !isWatching(watchlist, 'target', target)
    if (nowWatching) {
      await addToWatchlist('target', target)
      trackEvent('watchlist_item_added', { source: 'mobile_hub' })
      let message = 'Watching. Atlas will notify you about good viewing windows.'
      try {
        const pushReady = await ensurePushSubscription()
        const confirmed = pushReady ? await queueWatchConfirmation({ id: target, title: target }) : false
        if (confirmed) message = 'Watching. A confirmation notification is queued.'
        else if (!pushReady) message = 'Watching saved, but push is not enabled. Enable it in Profile to receive notifications.'
      } catch (err) {
        message = 'Watching saved, but push setup needs attention in Profile.'
        trackEvent('sync_failed', { stage: 'watch_confirmation_push', error: String(err) })
      }
      setWatchlist(await getWatchlist())
      return { watching: true, message }
    }
    await removeFromWatchlist('target', target)
    trackEvent('watchlist_item_removed', { source: 'mobile_hub' })
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
    openSubject(subject, event, 'list_item')
  }

  function openHeroTarget() {
    if (!plan || plan.targets.length === 0) return
    const target = plan.targets[0]
    const sourceEvent = events.find((e) => e.id === target.eventId)
    const subject = buildEventDetail(detailInputFromTonightTarget(target, plan.moonIlluminationPct, plan.darknessWindow, sourceEvent, city), plan.todayAdvisory)
    openSubject(subject, sourceEvent, 'hero_target')
  }

  function openSubject(subject: EntryDetailSubject, sourceEvent?: SkyEvent, source: 'list_item' | 'hero_target' | 'subject' = 'subject') {
    trackEvent('detail_sheet_opened', { source, kind: sourceEvent?.kind })
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

  function logEntryDetailAttempt() {
    if (!entryDetail) return
    const { subject } = entryDetail
    trackEvent('Logged observation', {
      hasTarget: true,
      hasPhoto: false,
      source: 'detail_sheet',
    })
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

  const spaceWeatherEvent = events.find((e) => e.kind === 'aurora' || e.kind === 'solar_flare')
  const now = new Date()

  const todayKey = localDateKey(now.toISOString(), city.timeZone)
  const weekEndKey = localDateKey(new Date(now.getTime() + 7 * 86_400_000).toISOString(), city.timeZone)
  const upcomingFilterPredicates: Record<HubFilterKey, (e: SkyEvent) => boolean> = {
    all: () => true,
    tonight: (e) => localDateKey(e.startsAt, city.timeZone) === todayKey,
    week: (e) => localDateKey(e.startsAt, city.timeZone) <= weekEndKey,
    watching: (e) => matchesWatchlist(e, watchlist),
  }
  const upcomingCounts: Record<HubFilterKey, number> = {
    all: events.length,
    tonight: events.filter(upcomingFilterPredicates.tonight).length,
    week: events.filter(upcomingFilterPredicates.week).length,
    watching: events.filter(upcomingFilterPredicates.watching).length,
  }
  const upcomingShown = events.filter(upcomingFilterPredicates[upcomingFilter])
  const upcomingGroups = useMemo(() => {
    if (!upcomingShown.length) return []
    const byDay = new Map<string, SkyEvent[]>()
    for (const event of upcomingShown) {
      const key = localDateKey(event.startsAt, city.timeZone)
      if (!byDay.has(key)) byDay.set(key, [])
      byDay.get(key)!.push(event)
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, dayEvents]) => ({ key, label: dayGroupLabel(key, todayKey, city.timeZone), events: dayEvents }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upcomingShown, city.timeZone, todayKey])

  return (
    <div className="az-page">
      <p className="az-kicker">
        {now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} · after dark
      </p>
      <h1 className="az-h1">
        {plan
          ? headlineFor(plan)
          : !hasLocation
            ? 'Flagship events, worldwide'
            : loadError
              ? "Couldn't load tonight"
              : 'Loading tonight…'}
      </h1>
      {!hasLocation && (
        <div
          className="az-card"
          role="note"
          style={{ marginTop: '0.875rem', padding: '1rem 1.125rem', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}
        >
          <div style={{ flex: '1 1 16rem' }}>
            <strong style={{ display: 'block' }}>You&rsquo;re seeing flagship events only</strong>
            <p className="az-muted" style={{ margin: '0.25rem 0 0' }}>
              Share your location to unlock more: tonight&rsquo;s plan for your sky, local weather and visibility, and events near you.
            </p>
          </div>
          {onRequestLocation && (
            <button type="button" className="az-btn az-btn-outline" onClick={onRequestLocation}>
              Use my location
            </button>
          )}
        </div>
      )}
      {!plan && loadError && (
        <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <p className="az-muted" style={{ margin: 0 }}>
            Check your connection and try again.
          </p>
          <button type="button" className="az-btn az-btn-outline" onClick={() => setRetryTick((n) => n + 1)}>
            Try again
          </button>
        </div>
      )}
      {plan?.todayAdvisory && (
        <p className="az-hero-title">
          {Math.round(100 - plan.todayAdvisory.cloudCoverPct)}% clear skies expected. Dark window{' '}
          {timeLabel(plan.darknessWindow.astronomicalDuskAt ?? plan.darknessWindow.civilDuskAt, city.timeZone)}–
          {timeLabel(plan.darknessWindow.astronomicalDawnAt ?? plan.darknessWindow.civilDawnAt, city.timeZone)}.
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
              {timeLabel(plan.targets[0].bestTime, city.timeZone)}
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

      <div className="az-section-head" style={{ marginTop: '1.375rem' }}>
        <span className="az-kicker">Upcoming</span>
      </div>
      <div className="az-chip-row">
        {HUB_FILTERS.map((f) => (
          <button
            type="button"
            key={f.key}
            className={`az-chip${upcomingFilter === f.key ? ' is-active' : ''}`}
            onClick={() => setUpcomingFilter(f.key)}
          >
            {f.label}
            <span className="az-chip-count">{upcomingCounts[f.key]}</span>
          </button>
        ))}
      </div>

      {upcomingGroups.map((group) => (
        <div key={group.key} style={{ marginTop: '1.125rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
            <span className="az-kicker">{group.label}</span>
            <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
          </div>
          <div className="az-row-group">
            {group.events.map((event) => (
              <button type="button" key={event.id} className="az-row" onClick={() => openEventDetail(event)}>
                <span className="az-row-icon">
                  <MobileIcon name={(categoryForKind(event.kind)?.icon as MobileIconName) ?? 'zap'} />
                </span>
                <span className="az-row-main">
                  <span className="az-row-kind">
                    {categoryForKind(event.kind)?.label.toUpperCase() ?? event.kind}
                    {matchesWatchlist(event, watchlist) ? ' · WATCHING' : ''}
                  </span>
                  <span className="az-row-title">{event.title}</span>
                </span>
                <span className="az-row-trail">
                  <span className="az-row-time">{timeLabel(event.startsAt, city.timeZone)}</span>
                  <span className="az-row-note">{reminders.some((r) => r.eventId === event.id) ? 'reminder armed' : ''}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}

      {upcomingGroups.length === 0 && (
        <div className="az-card-body" style={{ marginTop: '1rem', textAlign: 'center', border: '1px dashed var(--line2)', background: 'none' }}>
          <p style={{ margin: 0, fontWeight: 500, fontSize: '0.875rem' }}>Nothing in this filter</p>
          <p className="az-muted" style={{ margin: '0.375rem 0 0', fontSize: '0.8125rem' }}>
            {upcomingFilter === 'watching' ? 'Open an event and tap Watch to add it here.' : 'Try a wider window.'}
          </p>
        </div>
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

// Times belong to the place being observed, not the device doing the looking.
// Defaulting to the browser's zone meant picking a city in another country
// showed its darkness window shifted by the offset between the two -- Zurich's
// 21:16 dusk read as "03:16" on a device set to Melbourne. TonightPlan already
// carries the location's zone; this just has to use it.
function timeLabel(iso: string | null | undefined, timeZone?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone })
}
