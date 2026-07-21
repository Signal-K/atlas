import { useEffect, useId, useState } from 'react'
import type { City } from '../lib/cities'
import { curatedLocationMatches, searchLocations } from '../lib/locationSearch'

interface LocationSearchInputProps {
  id: string
  value: string
  onChange: (value: string) => void
  onSelect: (city: City) => void
  placeholder?: string
}

export function LocationSearchInput({ id, value, onChange, onSelect, placeholder = 'Town or city' }: LocationSearchInputProps) {
  const listId = useId()
  const [results, setResults] = useState<City[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const query = value.trim()
    if (query.length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    const controller = new AbortController()
    const fallback = curatedLocationMatches(query)
    setResults(fallback)
    setLoading(true)
    const timer = window.setTimeout(() => {
      searchLocations(query, controller.signal)
        .then((matches) => setResults(matches.length > 0 ? matches : fallback))
        .catch((error: unknown) => {
          if (!(error instanceof DOMException && error.name === 'AbortError')) setResults(fallback)
        })
        .finally(() => setLoading(false))
    }, 250)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [value])

  function choose(city: City) {
    onSelect(city)
    setOpen(false)
  }

  return (
    <div className="location-search">
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
      />
      {open && value.trim().length >= 2 && (
        <div className="location-search-popover" id={listId} role="listbox">
          {results.map((city) => (
            <button
              type="button"
              role="option"
              key={`${city.lat}:${city.lon}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(city)}
            >
              <strong>{city.name}</strong>
              <span>{[city.admin1, city.country].filter(Boolean).join(', ') || `${city.lat.toFixed(2)}, ${city.lon.toFixed(2)}`}</span>
            </button>
          ))}
          {loading && <span className="location-search-status">Searching places…</span>}
          {!loading && results.length === 0 && <span className="location-search-status">No matching place found.</span>}
        </div>
      )}
    </div>
  )
}
