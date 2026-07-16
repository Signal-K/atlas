import type { DarknessWindow } from '../lib/tonightTargets'

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

interface BestTimeTimelineProps {
  darknessWindow: DarknessWindow
  targetTime: string // ISO
  now?: Date
}

// STS-316: a simple vertical bar from dusk to dawn, marking the darkest
// stretch of the night and the target's own best time within it -- a plain
// sentence alone doesn't convey "how soon" or "how much night is left"
// the way a glance at the bar does.
export function BestTimeTimeline({ darknessWindow, targetTime, now = new Date() }: BestTimeTimelineProps) {
  const startIso = darknessWindow.civilDuskAt ?? targetTime
  const endIso = darknessWindow.civilDawnAt ?? targetTime
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  const span = Math.max(end - start, 1)

  const clampPct = (iso: string) => Math.min(100, Math.max(0, ((new Date(iso).getTime() - start) / span) * 100))

  const astroDuskPct = darknessWindow.astronomicalDuskAt ? clampPct(darknessWindow.astronomicalDuskAt) : null
  const astroDawnPct = darknessWindow.astronomicalDawnAt ? clampPct(darknessWindow.astronomicalDawnAt) : null
  const targetPct = clampPct(targetTime)
  const nowPct = now.getTime() >= start && now.getTime() <= end ? clampPct(now.toISOString()) : null

  return (
    <div className="best-time-timeline">
      <div className="best-time-timeline-bar">
        {astroDuskPct != null && astroDawnPct != null && (
          <div
            className="best-time-timeline-dark-window"
            style={{ top: `${astroDuskPct}%`, height: `${Math.max(astroDawnPct - astroDuskPct, 0)}%` }}
          />
        )}
        {nowPct != null && <div className="best-time-timeline-now" style={{ top: `${nowPct}%` }} />}
        <div className="best-time-timeline-target" style={{ top: `${targetPct}%` }} />
      </div>
      <div className="best-time-timeline-labels">
        <span>{formatTime(startIso)}</span>
        <span>{formatTime(endIso)}</span>
      </div>
    </div>
  )
}
