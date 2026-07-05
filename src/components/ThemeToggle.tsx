import { useEffect, useState } from 'react'
import { applyTheme, getStoredTheme, getSystemTheme, storeTheme, type Theme } from '../lib/theme'

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme() ?? getSystemTheme())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label="Toggle dark mode"
      onClick={() => {
        const next = theme === 'dark' ? 'light' : 'dark'
        setTheme(next)
        storeTheme(next)
      }}
    >
      {theme === 'dark' ? '☀︎' : '☾'}
    </button>
  )
}
