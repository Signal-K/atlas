import { useEffect, useState } from 'react'

// The Atlas mobile app shell should be used for phones, tablet-ish browser
// widths, and installed/touch-first contexts. The desktop shell remains for
// full-width desktop where the sidebar layout has room to breathe.
const QUERY = '(max-width: 1180px), (pointer: coarse)'

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
