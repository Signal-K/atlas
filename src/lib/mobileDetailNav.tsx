import { createContext, useContext, useState, type ReactNode } from 'react'

interface MobileDetailNavContextValue {
  active: boolean
  setActive: (active: boolean) => void
}

const MobileDetailNavContext = createContext<MobileDetailNavContextValue | null>(null)

// Lets a full-screen detail overlay (e.g. an open event) tell the mobile
// bottom bar to swap from its normal Events/Journal/Settings tabs to a
// back/swipe control, without threading that state through every layer
// between the overlay and the dock.
export function MobileDetailNavProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false)
  return <MobileDetailNavContext.Provider value={{ active, setActive }}>{children}</MobileDetailNavContext.Provider>
}

export function useMobileDetailNav() {
  const ctx = useContext(MobileDetailNavContext)
  if (!ctx) throw new Error('useMobileDetailNav must be used within MobileDetailNavProvider')
  return ctx
}
