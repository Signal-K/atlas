import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'atlas-theme'
const THEME_CHANGED_EVENT = 'atlas:theme-changed'

export function getStoredTheme(): Theme | null {
  const value = localStorage.getItem(STORAGE_KEY)
  return value === 'light' || value === 'dark' ? value : null
}

export function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  window.dispatchEvent(new CustomEvent<Theme>(THEME_CHANGED_EVENT, { detail: theme }))
}

export function storeTheme(theme: Theme) {
  localStorage.setItem(STORAGE_KEY, theme)
}

// Reactive theme toggle for the TopBar/Profile appearance row -- both call
// this independently, so it listens for applyTheme's event to stay in sync
// no matter which instance actually triggered the change.
export function useThemeState(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme() ?? getSystemTheme())

  useEffect(() => {
    function onThemeChanged(event: Event) {
      setTheme((event as CustomEvent<Theme>).detail)
    }
    window.addEventListener(THEME_CHANGED_EVENT, onThemeChanged)
    return () => window.removeEventListener(THEME_CHANGED_EVENT, onThemeChanged)
  }, [])

  const toggle = useCallback(() => {
    const next: Theme = (getStoredTheme() ?? getSystemTheme()) === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    storeTheme(next)
  }, [])

  return [theme, toggle]
}
