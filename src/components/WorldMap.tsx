import { CITIES, type City } from '../lib/cities'

// Deliberately not a coastline map — a stylised equirectangular graticule
// with real city coordinates plotted on it, in the same minimal-lines
// aesthetic as the rest of the app rather than pretending to be an accurate
// atlas. Redone (AT-029 follow-up) with a globe-like glow backdrop, softer
// dotted graticule, and a pulsing ring on the selected city so it reads as
// a deliberate "pick a place on the sky" surface rather than a bare grid.
const WIDTH = 360
const HEIGHT = 180

const LAND_PATHS = [
  // North America
  'M32 38 L50 24 L82 22 L108 36 L119 57 L101 75 L72 78 L49 67 Z',
  // South America
  'M96 86 L118 98 L128 126 L119 156 L101 171 L88 143 L78 112 Z',
  // Europe
  'M169 43 L190 36 L207 45 L196 60 L174 59 Z',
  // Africa
  'M178 66 L207 67 L223 94 L213 136 L191 151 L171 125 L164 91 Z',
  // Asia
  'M204 43 L250 31 L301 49 L326 75 L300 94 L261 83 L231 97 L203 72 Z',
  // Australia
  'M278 126 L312 120 L331 135 L319 153 L286 151 Z',
  // Greenland
  'M103 18 L129 10 L150 22 L137 38 L111 35 Z',
]

function project(lat: number, lon: number): { x: number; y: number } {
  return { x: lon + 180, y: 90 - lat }
}

export function WorldMap({
  selected,
  onSelect,
  eventCounts = new Map(),
}: {
  selected: City | null
  onSelect: (city: City) => void
  eventCounts?: Map<string, number>
}) {
  const graticuleLines = []
  for (let lon = -180; lon <= 180; lon += 30) {
    graticuleLines.push(
      <line key={`v${lon}`} x1={lon + 180} y1={0} x2={lon + 180} y2={HEIGHT} className="map-graticule" />,
    )
  }
  for (let lat = -90; lat <= 90; lat += 30) {
    graticuleLines.push(
      <line key={`h${lat}`} x1={0} y1={90 - lat} x2={WIDTH} y2={90 - lat} className="map-graticule" />,
    )
  }

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="world-map" role="img" aria-label="World map location picker">
      <defs>
        <radialGradient id="map-glow" cx="50%" cy="42%" r="75%">
          <stop offset="0%" className="map-glow-center" />
          <stop offset="100%" className="map-glow-edge" />
        </radialGradient>
        <clipPath id="map-clip">
          <rect x={1} y={1} width={WIDTH - 2} height={HEIGHT - 2} rx={10} />
        </clipPath>
      </defs>
      <g clipPath="url(#map-clip)">
        <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="url(#map-glow)" />
        <g className="map-land-layer">
          {LAND_PATHS.map((path) => (
            <path key={path} d={path} className="map-land" />
          ))}
        </g>
        {graticuleLines}
        <line x1={0} y1={90} x2={WIDTH} y2={90} className="map-equator" />
        <rect x={1} y={1} width={WIDTH - 2} height={HEIGHT - 2} rx={10} className="map-frame" />
        {CITIES.map((city) => {
          const { x, y } = project(city.lat, city.lon)
          const isActive = selected?.name === city.name
          const labelAbove = city.lat < 0
          const count = eventCounts.get(city.name) ?? 0
          return (
            <g
              key={city.name}
              className="map-pin-group"
              onClick={() => onSelect(city)}
              role="button"
              tabIndex={0}
              aria-label={`Select ${city.name}`}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') onSelect(city)
              }}
            >
              {/* Larger invisible circle so the tap/click target is comfortable
                  even though the visible dot stays small at this map scale. */}
              <circle cx={x} cy={y} r={7} className="map-pin-hitarea" />
              {isActive && <circle cx={x} cy={y} r={4.5} className="map-pin-pulse" />}
              <circle cx={x} cy={y} r={isActive ? 4 : 3} className={`map-pin${isActive ? ' is-active' : ''}`} />
              {count > 0 && (
                <text x={x + 7} y={y - 5} className="map-pin-count">
                  {count}
                </text>
              )}
              <text x={x} y={labelAbove ? y - 8 : y + 12} className={`map-pin-label${isActive ? ' is-active' : ''}`}>
                {city.name}
              </text>
            </g>
          )
        })}
      </g>
    </svg>
  )
}
