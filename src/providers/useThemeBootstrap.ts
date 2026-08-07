import { useEffect } from 'react'
import { applyTheme, getStoredTheme, getSystemTheme } from '../lib/theme'

// Applies a stored manual theme choice -- or the system preference -- from
// first paint, instead of only after the user visits Settings once.
export function useThemeBootstrap() {
  useEffect(() => {
    applyTheme(getStoredTheme() ?? getSystemTheme())
  }, [])
}
