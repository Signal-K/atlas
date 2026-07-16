// STS-317: a minimal compass rose for the plan screen's "where to look"
// section -- N fixed at the top, a pointer rotated to the target's azimuth,
// and its distance from the center standing in for altitude (higher in the
// sky sits nearer the middle, since that's overhead rather than "far away").
export function SkyDirectionCompass({ azimuthDeg, altitudeDeg }: { azimuthDeg: number; altitudeDeg: number }) {
  const size = 72
  const center = size / 2
  const radius = center - 10
  // 90deg altitude (straight up) -> distance 0 (center). 0deg (horizon) -> full radius.
  const distance = radius * (1 - Math.min(Math.max(altitudeDeg, 0), 90) / 90)
  const angleRad = ((azimuthDeg - 90) * Math.PI) / 180
  const pointX = center + distance * Math.cos(angleRad)
  const pointY = center + distance * Math.sin(angleRad)

  return (
    <svg
      className="sky-direction-compass"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Direction: ${Math.round(azimuthDeg)} degrees, ${Math.round(altitudeDeg)} degrees up`}
    >
      <circle cx={center} cy={center} r={radius} className="sky-direction-compass-ring" />
      <text x={center} y={10} textAnchor="middle" className="sky-direction-compass-label">
        N
      </text>
      <text x={size - 6} y={center + 4} textAnchor="end" className="sky-direction-compass-label">
        E
      </text>
      <text x={center} y={size - 4} textAnchor="middle" className="sky-direction-compass-label">
        S
      </text>
      <text x={6} y={center + 4} textAnchor="start" className="sky-direction-compass-label">
        W
      </text>
      <line x1={center} y1={center} x2={pointX} y2={pointY} className="sky-direction-compass-needle" />
      <circle cx={pointX} cy={pointY} r={4} className="sky-direction-compass-dot" />
    </svg>
  )
}
