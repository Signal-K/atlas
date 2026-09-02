// Shared 3-/4-up stat tile row -- Hub's tonight strip, Journal's "mine"
// stats, Event Detail's stat grid.
export function StatGrid({ stats }: { stats: Array<{ value: string; label: string }> }) {
  return (
    <div className="az-stat-grid" style={{ '--az-stat-cols': stats.length } as React.CSSProperties}>
      {stats.map((s, i) => (
        <div className="az-stat" key={i}>
          <strong>{s.value}</strong>
          <small>{s.label}</small>
        </div>
      ))}
    </div>
  )
}
