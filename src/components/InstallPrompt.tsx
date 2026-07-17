import { useEffect, useState } from 'react'
import { trackEvent } from '../lib/analytics'

const DISMISSED_KEY = 'atlas-install-dismissed-at'
const DISMISS_COOLDOWN_DAYS = 14

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent
  const isIos = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
  // Exclude other iOS browsers (Chrome/Firefox on iOS) and in-app browsers,
  // which can't install PWAs even though they share Safari's engine.
  const isOtherIosBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|mercury/.test(ua)
  return isIos && !isOtherIosBrowser
}

function daysSince(iso: string | null): number {
  if (!iso) return Number.POSITIVE_INFINITY
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return Number.POSITIVE_INFINITY
  return (Date.now() - then) / 86_400_000
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosHint, setShowIosHint] = useState(false)
  const dismissedRecently = daysSince(localStorage.getItem(DISMISSED_KEY)) < DISMISS_COOLDOWN_DAYS

  useEffect(() => {
    if (isStandalone() || dismissedRecently) return

    if (isIosSafari()) {
      setShowIosHint(true)
      return
    }

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [dismissedRecently])

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, new Date().toISOString())
    trackEvent('Install prompt dismissed', { platform: showIosHint ? 'ios_safari' : 'chromium' })
    setDeferredPrompt(null)
    setShowIosHint(false)
  }

  async function install() {
    if (!deferredPrompt) return
    trackEvent('Install prompt accepted', { platform: 'chromium' })
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    trackEvent('Install prompt resolved', { platform: 'chromium', outcome: choice.outcome })
    setDeferredPrompt(null)
  }

  if (!deferredPrompt && !showIosHint) return null

  return (
    <div className="install-prompt" role="dialog" aria-label="Install Atlas">
      {showIosHint ? (
        <p>
          Install Atlas: tap <span className="install-prompt-icon" aria-hidden="true">⬆️</span> Share, then
          "Add to Home Screen".
        </p>
      ) : (
        <p>Install Atlas for quick access and offline sky plans.</p>
      )}
      <div className="install-prompt-actions">
        {!showIosHint && (
          <button type="button" className="install-prompt-cta" onClick={install}>
            Install
          </button>
        )}
        <button type="button" className="install-prompt-dismiss" onClick={dismiss} aria-label="Dismiss install prompt">
          Not now
        </button>
      </div>
    </div>
  )
}
