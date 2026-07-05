import { CITIES, type City } from '../lib/cities'

// Deliberately not a coastline map — a stylised equirectangular graticule
// with real city coordinates plotted on it, in the same minimal-lines
// aesthetic as the rest of the app rather than pretending to be an accurate
// atlas.
const WIDTH = 360
const HEIGHT = 180

function project(lat: number, lon: number): { x: number; y: number } {
  return { x: lon + 180, y: 90 - lat }
}

export function WorldMap({ selected, onSelect }: { selected: City | null; onSelect: (city: City) => void }) {
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
      <rect x={0} y={0} width={WIDTH} height={HEIGHT} className="map-background" />
      {graticuleLines}
      <line x1={0} y1={90} x2={WIDTH} y2={90} className="map-equator" />
      {CITIES.map((city) => {
        const { x, y } = project(city.lat, city.lon)
        const isActive = selected?.name === city.name
        return (
          <g key={city.name} className="map-pin-group" onClick={() => onSelect(city)}>
            <circle cx={x} cy={y} r={isActive ? 4 : 2.5} className={`map-pin${isActive ? ' is-active' : ''}`} />
            <title>{city.name}</title>
          </g>
        )
      })}
    </svg>
  )
}
