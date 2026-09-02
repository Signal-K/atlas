import { createContext, useCallback, useContext, useRef, useState } from 'react'

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

  const showToast = useCallback((message: string) => {
    const id = nextId.current++
    setToasts((current) => [...current, { id, message }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id))
    }, 2600)
  }, [])

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
