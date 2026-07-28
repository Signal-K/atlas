import { CITIES, type City } from '../lib/cities'

const TILE_ZOOM = 2
const TILE_RANGE = Array.from({ length: 2 ** TILE_ZOOM }, (_, index) => index)

function project(lat: number, lon: number): { left: number; top: number } {
  const clampedLat = Math.max(-85.0511, Math.min(85.0511, lat))
  const sin = Math.sin((clampedLat * Math.PI) / 180)
  const worldY = 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)
  // The four-by-four Web Mercator tile square is cropped to a wide map
  // viewport. These coordinates apply the same crop to the marker layer.
  return { left: ((lon + 180) / 360) * 100, top: worldY * 200 - 50 }
}

function samePlace(a: City | null, b: City): boolean {
  return !!a && Math.abs(a.lat - b.lat) < 0.05 && Math.abs(a.lon - b.lon) < 0.05
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
  const hasSelectedCityPin = CITIES.some((city) => samePlace(selected, city))

  return (
    <div className="world-map" role="group" aria-label="World map location picker">
      <div className="world-map-tiles" aria-hidden="true">
        {TILE_RANGE.flatMap((x) =>
          TILE_RANGE.map((y) => (
            <img
              key={`${x}:${y}`}
              src={`https://tile.openstreetmap.org/${TILE_ZOOM}/${x}/${y}.png`}
              alt=""
              loading="lazy"
              draggable="false"
            />
          )),
        )}
      </div>
      <div className="world-map-shade" aria-hidden="true" />
      <div className="world-map-markers">
        {CITIES.map((city) => {
          const position = project(city.lat, city.lon)
          const active = samePlace(selected, city)
          const count = eventCounts.get(city.name) ?? 0
          return (
            <button
              type="button"
              key={city.name}
              className={`world-map-marker${active ? ' is-active' : ''}`}
              style={{ left: `${position.left}%`, top: `${position.top}%` }}
              onClick={() => onSelect(city)}
              aria-label={`Select ${city.name}${count > 0 ? `, ${count} upcoming events` : ''}`}
              title={city.name}
            >
              <span className="world-map-marker-pin" aria-hidden="true" />
              {active && <span className="world-map-marker-label">{city.name}</span>}
            </button>
          )
        })}
        {selected && !hasSelectedCityPin && (() => {
          const position = project(selected.lat, selected.lon)
          return (
            <button
              type="button"
              className="world-map-marker is-active is-current"
              style={{ left: `${position.left}%`, top: `${position.top}%` }}
              onClick={() => onSelect(selected)}
              aria-label={`Current location: ${selected.name}`}
              title={selected.name}
            >
              <span className="world-map-marker-pin" aria-hidden="true" />
              <span className="world-map-marker-label">{selected.name}</span>
            </button>
          )
        })()}
      </div>
      <span className="world-map-attribution">© OpenStreetMap contributors</span>
    </div>
  )
}
