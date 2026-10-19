import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

// Global toast surface -- one provider mounted in AppShell, matching the
// Atlas Mobile mockup's this.toast(message) pattern (2.6s auto-dismiss,
// pinned above the tab bar).
interface ToastEntry {
  id: number
  message: string
}

const ToastContext = createContext<((message: string) => void) | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const nextId = useRef(0)
  const updateToastShown = useRef(false)

  const showToast = useCallback((message: string) => {
    const id = nextId.current++
    setToasts((current) => [...current, { id, message }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id))
    }, 2600)
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'atlas-update-available' || updateToastShown.current) return
      updateToastShown.current = true
      showToast('Atlas updated. Reload when convenient.')
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [showToast])

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="az-toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="az-toast">
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const showToast = useContext(ToastContext)
  if (!showToast) throw new Error('useToast must be used within a ToastProvider')
  return showToast
}
