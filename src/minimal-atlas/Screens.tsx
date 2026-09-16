import type { EventRecord } from './data'
import { dayInfo, JOURNAL } from './data'
import { EventGlyph, IconChevronRight, IconWatchShield } from './icons'
import { Avatar, Badge, Button } from './ui/kit'

export type DecoratedEvent = EventRecord & {
  watching: boolean
  dayLabel: string
  dayDate: string
  metaLine: string
}

export type EventGroup = { day: number; label: string; date: string; labelColor: string; events: DecoratedEvent[] }

export function groupByDay(list: DecoratedEvent[]): EventGroup[] {
  const out: EventGroup[] = []
  for (const ev of list) {
    let g = out.find((x) => x.day === ev.day)
    if (!g) {
      const info = dayInfo(ev.day)
      g = { day: ev.day, label: info.label, date: info.date, labelColor: ev.day === 0 ? 'var(--ak-violet-strong)' : 'var(--ak-muted)', events: [] }
      out.push(g)
    }
    g.events.push(ev)
  }
  return out
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'tonight', label: 'Tonight' },
  { key: 'week', label: 'This week' },
  { key: 'watching', label: 'Watching' },
] as const

export type FilterKey = (typeof FILTERS)[number]['key']

export function FocusScreen({
  city,
  filter,
  counts,
  weekCount,
  groups,
  empty,
  emptyNote,
  rowPad,
  onPickFilter,
  onOpen,
  onToggleWatch,
}: {
  city: string
  filter: FilterKey
  counts: Record<FilterKey, number>
  weekCount: number
  groups: EventGroup[]
  empty: boolean
  emptyNote: string
  rowPad: string
  onPickFilter: (key: FilterKey) => void
  onOpen: (id: string) => void
  onToggleWatch: (id: string) => void
}) {
  return (
    <>
      <div style={{ padding: '18px 0 0' }}>
        <h1 style={{ margin: 0, font: '700 30px/1.05 var(--ak-font-display)', letterSpacing: '-.02em' }}>Upcoming</h1>
        <p style={{ margin: '7px 0 0', fontSize: 13.5, lineHeight: 1.5, color: 'var(--ak-muted)', maxWidth: '30ch' }}>
          {`${weekCount} events in the next seven nights from ${city}. Tap a row to see how to catch it.`}
        </p>
        <div className="mx-scroll" style={{ display: 'flex', gap: 7, marginTop: 16, overflowX: 'auto', paddingBottom: 2 }}>
          {FILTERS.map((f) => {
            const on = f.key === filter
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => onPickFilter(f.key)}
                style={{
                  flex: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 13px',
                  borderRadius: 999,
                  cursor: 'pointer',
                  font: '500 12.5px var(--ak-font-sans)',
                  whiteSpace: 'nowrap',
                  border: `1px solid ${on ? 'transparent' : 'var(--ak-line)'}`,
                  background: on ? 'var(--ak-ink)' : 'var(--ak-surface)',
                  color: on ? 'var(--ak-bg)' : 'var(--ak-ink)',
                }}
              >
                {f.label}
                <span style={{ font: '500 11px var(--ak-font-mono)', opacity: 0.5 }}>{counts[f.key]}</span>
              </button>
            )
          })}
        </div>
      </div>

      {groups.map((g) => (
        <div key={g.day} style={{ marginTop: 26 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
            <span style={{ font: '600 10.5px var(--ak-font-mono)', letterSpacing: '.14em', textTransform: 'uppercase', color: g.labelColor }}>{g.label}</span>
            <span style={{ flex: 1, height: 1, background: 'var(--ak-line)' }} />
            <span style={{ font: '500 10.5px var(--ak-font-mono)', color: 'var(--ak-muted)' }}>{g.date}</span>
          </div>
          {g.events.map((ev) => (
            <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: `${rowPad} 2px`, borderBottom: '1px solid var(--ak-line)' }}>
              <button
                type="button"
                onClick={() => onOpen(ev.id)}
                style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 0, padding: 0, margin: 0, textAlign: 'left', color: 'inherit', fontFamily: 'inherit', cursor: 'pointer' }}
              >
                <span style={{ flex: 'none', width: 26, height: 26, display: 'grid', placeItems: 'center', color: 'var(--ak-muted)' }}>
                  <EventGlyph icon={ev.icon} />
                </span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontWeight: 500, fontSize: 14.5, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</span>
                  <span style={{ font: '500 10.5px var(--ak-font-mono)', letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--ak-muted)' }}>{ev.metaLine}</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => onToggleWatch(ev.id)}
                aria-label="Toggle watch"
                style={{ flex: 'none', width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 8, background: ev.watching ? 'var(--ak-violet-wash)' : 'transparent', border: 0, cursor: 'pointer', color: ev.watching ? 'var(--ak-violet-strong)' : 'var(--ak-muted)' }}
              >
                <IconWatchShield filled={ev.watching} />
              </button>
            </div>
          ))}
        </div>
      ))}

      {empty && (
        <div style={{ marginTop: 40, padding: '28px 20px', border: '1px dashed var(--ak-line-strong)', borderRadius: 'var(--ak-radius-md)', textAlign: 'center' }}>
          <p style={{ margin: 0, fontWeight: 500, fontSize: 14 }}>Nothing in this filter</p>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--ak-muted)' }}>{emptyNote}</p>
        </div>
      )}
    </>
  )
}

export function EventsScreen({
  tab,
  onSetTab,
  monthLabel,
  city,
  calendar,
  allGroups,
  rowPad,
  onOpen,
}: {
  tab: 'list' | 'calendar'
  onSetTab: (k: 'list' | 'calendar') => void
  monthLabel: string
  city: string
  calendar: Array<{ label: string; bg: string; fg: string; dot: number }>
  allGroups: EventGroup[]
  rowPad: string
  onOpen: (id: string) => void
}) {
  const dayHeads = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  return (
    <>
      <div style={{ padding: '18px 0 0' }}>
        <h1 style={{ margin: 0, font: '700 30px/1.05 var(--ak-font-display)', letterSpacing: '-.02em' }}>Events</h1>
        <p style={{ margin: '7px 0 18px', fontSize: 13.5, color: 'var(--ak-muted)' }}>Everything on the calendar for the next 30 days.</p>
        <div className="ak-tabs" role="tablist">
          {(['list', 'calendar'] as const).map((k) => (
            <button key={k} type="button" role="tab" className="ak-tab" data-active={tab === k} aria-selected={tab === k} onClick={() => onSetTab(k)}>
              {k === 'list' ? 'List' : 'Calendar'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'calendar' && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
            <strong style={{ font: '700 16px var(--ak-font-display)' }}>{monthLabel}</strong>
            <span style={{ font: '500 10.5px var(--ak-font-mono)', letterSpacing: '.12em', color: 'var(--ak-muted)' }}>{city.toUpperCase()}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 6 }}>
            {dayHeads.map((d, i) => (
              <span key={i} style={{ textAlign: 'center', font: '500 10px var(--ak-font-mono)', color: 'var(--ak-muted)' }}>
                {d}
              </span>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
            {calendar.map((c, i) => (
              <span key={i} style={{ aspectRatio: '1', display: 'grid', placeItems: 'center', position: 'relative', borderRadius: 9, font: '500 12.5px var(--ak-font-mono)', background: c.bg, color: c.fg }}>
                {c.label}
                <i style={{ position: 'absolute', bottom: 5, width: 4, height: 4, borderRadius: '50%', background: 'var(--ak-violet)', opacity: c.dot }} />
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 14 }}>
            <i style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--ak-violet)' }} />
            <span style={{ font: '500 10px var(--ak-font-mono)', letterSpacing: '.12em', color: 'var(--ak-muted)' }}>EVENT SCHEDULED</span>
          </div>
        </div>
      )}

      {tab === 'list' && (
        <div style={{ marginTop: 12 }}>
          {allGroups.map((g) => (
            <div key={g.day} style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
                <span style={{ font: '600 10.5px var(--ak-font-mono)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ak-muted)' }}>{g.label}</span>
                <span style={{ flex: 1, height: 1, background: 'var(--ak-line)' }} />
              </div>
              {g.events.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => onOpen(ev.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: 'none', border: 0, borderBottom: '1px solid var(--ak-line)', padding: `${rowPad} 2px`, margin: 0, textAlign: 'left', color: 'inherit', fontFamily: 'inherit', cursor: 'pointer' }}
                >
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontWeight: 500, fontSize: 14.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</span>
                    <span style={{ font: '500 10.5px var(--ak-font-mono)', letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--ak-muted)' }}>{ev.cat}</span>
                  </span>
                  <span style={{ flex: 'none', font: '500 12.5px var(--ak-font-mono)', color: 'var(--ak-muted)' }}>{ev.time}</span>
                  <IconChevronRight />
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

export function JournalScreen() {
  return (
    <>
      <div style={{ padding: '18px 0 0' }}>
        <h1 style={{ margin: 0, font: '700 30px/1.05 var(--ak-font-display)', letterSpacing: '-.02em' }}>Journal</h1>
        <p style={{ margin: '7px 0 0', fontSize: 13.5, color: 'var(--ak-muted)' }}>{`4 entries. Attempts count as much as sightings.`}</p>
      </div>
      <JournalList />
    </>
  )
}

function JournalList() {
  return (
    <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column' }}>
      {JOURNAL.map((j) => (
        <div key={j.id} style={{ display: 'flex', gap: 13, padding: '15px 2px', borderBottom: '1px solid var(--ak-line)' }}>
          <span
            style={{
              flex: 'none',
              width: 52,
              height: 52,
              borderRadius: 10,
              display: 'grid',
              placeItems: 'center',
              font: '500 8px var(--ak-font-mono)',
              letterSpacing: '.12em',
              color: 'rgba(255,255,255,.4)',
              background: 'linear-gradient(150deg,#15161f,#2a2338)',
            }}
          >
            {j.thumb}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
              <Badge tone={j.tone} dot>
                {j.result}
              </Badge>
              <span style={{ font: '500 10px var(--ak-font-mono)', letterSpacing: '.1em', color: 'var(--ak-muted)' }}>{j.date}</span>
            </span>
            <span style={{ display: 'block', fontWeight: 500, fontSize: 14, lineHeight: 1.3 }}>{j.title}</span>
            <span style={{ display: 'block', marginTop: 3, fontSize: 12.5, lineHeight: 1.45, color: 'var(--ak-muted)' }}>{j.note}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

export function YouScreen({
  city,
  watchCount,
  journalCount,
  dark,
  onOpenLocation,
  onGoWatching,
  onToggleTheme,
}: {
  city: string
  watchCount: number
  journalCount: number
  dark: boolean
  onOpenLocation: () => void
  onGoWatching: () => void
  onToggleTheme: () => void
}) {
  const rows = [
    { label: 'Observing location', note: 'Used for every window and forecast', value: city, act: onOpenLocation },
    { label: 'Watching', note: 'Events pinned to your Upcoming view', value: String(watchCount), act: onGoWatching },
    { label: 'Theme', note: 'Starfield reads best on dark', value: dark ? 'Dark' : 'Light', act: onToggleTheme },
    { label: 'Sky Pass', note: '30-day lookahead, reminders, trips', value: 'Active', act: () => {} },
    { label: 'Offline data', note: 'Events and journal mirrored on device', value: '4.2 MB', act: () => {} },
  ]
  return (
    <>
      <div style={{ padding: '18px 0 0', display: 'flex', alignItems: 'center', gap: 13 }}>
        <Avatar name="Sam Kinetics" size="lg" />
        <span>
          <span style={{ display: 'block', font: '700 20px var(--ak-font-display)' }}>Sam Kinetics</span>
          <span style={{ display: 'block', marginTop: 2, font: '500 10.5px var(--ak-font-mono)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ak-muted)' }}>
            {`Sky Pass · ${watchCount} watching · ${journalCount} entries`}
          </span>
        </span>
      </div>
      <div style={{ marginTop: 24 }}>
        {rows.map((r) => (
          <button
            key={r.label}
            type="button"
            onClick={r.act}
            style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: 'none', border: 0, borderBottom: '1px solid var(--ak-line)', padding: '15px 2px', margin: 0, textAlign: 'left', color: 'inherit', fontFamily: 'inherit', cursor: 'pointer' }}
          >
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontWeight: 500, fontSize: 14.5 }}>{r.label}</span>
              <span style={{ fontSize: 12, color: 'var(--ak-muted)' }}>{r.note}</span>
            </span>
            <span style={{ flex: 'none', font: '500 12px var(--ak-font-mono)', color: 'var(--ak-muted)' }}>{r.value}</span>
            <IconChevronRight />
          </button>
        ))}
      </div>
    </>
  )
}

export function DetailScreen({
  event,
  city,
  watching,
  logged,
  toast,
  onToggleWatch,
  onLogAttempt,
}: {
  event: DecoratedEvent
  city: string
  watching: boolean
  logged: boolean
  toast: string
  onToggleWatch: () => void
  onLogAttempt: () => void
}) {
  const steps = [
    `Be outside around ${event.time} and let your eyes adapt for ten minutes.`,
    event.blurb,
    `Look ${event.look} from ${city}. Forecast cloud cover ${event.cloud}.`,
  ]
  const stats = [
    { value: event.time, label: 'BEST TIME' },
    { value: event.alt, label: 'PEAK ALT' },
    { value: event.look, label: 'LOOK' },
    { value: event.cloud, label: 'CLOUD' },
  ]
  return (
    <div style={{ padding: '14px 0 0' }}>
      <div
        style={{
          height: 150,
          borderRadius: 'var(--ak-radius-md)',
          display: 'grid',
          placeItems: 'center',
          font: '500 10px var(--ak-font-mono)',
          letterSpacing: '.14em',
          color: 'rgba(255,255,255,.42)',
          background: 'linear-gradient(160deg,#191a2b,#2c2140 55%,#4a2d4f)',
        }}
      >
        EVENT IMAGERY
      </div>
      <span style={{ display: 'block', margin: '16px 0 0', font: '600 10.5px var(--ak-font-mono)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ak-violet-strong)' }}>{event.cat}</span>
      <h1 style={{ margin: '6px 0 7px', font: '700 26px/1.1 var(--ak-font-display)', letterSpacing: '-.02em' }}>{event.title}</h1>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: 'var(--ak-muted)' }}>{`${event.dayLabel} · ${event.dayDate} · ${event.blurb}`}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, marginTop: 18, background: 'var(--ak-line)', borderRadius: 'var(--ak-radius-md)', overflow: 'hidden' }}>
        {stats.map((s) => (
          <span key={s.label} style={{ background: 'var(--ak-surface)', padding: '11px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <span style={{ font: '700 15px var(--ak-font-display)' }}>{s.value}</span>
            <span style={{ font: '500 8.5px var(--ak-font-mono)', letterSpacing: '.1em', color: 'var(--ak-muted)' }}>{s.label}</span>
          </span>
        ))}
      </div>

      <div style={{ margin: '26px 0 10px', font: '600 10.5px var(--ak-font-mono)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ak-muted)' }}>How to catch it</div>
      {steps.map((text, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, padding: '11px 2px', borderBottom: '1px solid var(--ak-line)' }}>
          <span style={{ flex: 'none', font: '500 11px var(--ak-font-mono)', color: 'var(--ak-violet-strong)', paddingTop: 2 }}>{String(i + 1).padStart(2, '0')}</span>
          <span style={{ flex: 1, fontSize: 13.5, lineHeight: 1.5 }}>{text}</span>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 9, marginTop: 22 }}>
        <span style={{ flex: 1, display: 'flex' }}>
          <Button variant={watching ? 'accent' : 'secondary'} onClick={onToggleWatch} style={{ flex: 1, width: '100%', minHeight: 44 }}>
            {watching ? 'Watching' : 'Watch'}
          </Button>
        </span>
        <span style={{ flex: 1, display: 'flex' }}>
          <Button variant="primary" onClick={onLogAttempt} style={{ flex: 1, width: '100%', minHeight: 44 }}>
            {logged ? 'Logged' : 'Log attempt'}
          </Button>
        </span>
      </div>
      <p style={{ margin: '12px 0 0', minHeight: 18, fontSize: 12.5, lineHeight: 1.4, color: 'var(--ak-violet-strong)' }}>{toast}</p>
    </div>
  )
}
