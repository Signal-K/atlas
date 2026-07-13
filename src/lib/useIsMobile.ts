import { useEffect, useState } from 'react'

// Matches the mobile breakpoint already used throughout App.css (see the
// comment on the max-width: 640px block there).
const QUERY = '(max-width: 640px)'

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(QUERY).matches)

  useEffect(() => {
    const query = window.matchMedia(QUERY)
    const handleChange = () => setIsMobile(query.matches)
    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])

  return isMobile
}
