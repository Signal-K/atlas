import { useEffect, useState } from 'react'
import { applyTheme, getStoredTheme, getSystemTheme, storeTheme, type Theme } from '../lib/theme'

export function ThemeSettings() {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme() ?? getSystemTheme())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  function choose(next: Theme) {
    setTheme(next)
    storeTheme(next)
  }

  return (
    <div className="settings-row">
      <span className="settings-label">Theme</span>
      <div className="settings-choice">
        <button type="button" className={theme === 'light' ? 'is-active' : ''} onClick={() => choose('light')}>
          Light
        </button>
        <button type="button" className={theme === 'dark' ? 'is-active' : ''} onClick={() => choose('dark')}>
          Dark
        </button>
      </div>
    </div>
  )
}
