import { ClerkProvider, SignIn, UserButton, useAuth } from '@clerk/react'

// KES-189 phase 1: proves the "Star Sailors" Clerk app (shared ecosystem
// identity, see the migration doc linked from that ticket) is reachable and
// renders from Atlas. Deliberately not wired into src/lib/auth.ts or
// pb.authStore yet -- that's phase 3, once the Clerk->PocketBase token
// exchange endpoint (phase 2) exists on the Go backend. Dev-only: rendered
// only when import.meta.env.DEV, which Vite replaces with a literal `false`
// in production builds, so this whole panel is dead-code-eliminated out of
// anything actually shipped.
const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined

// @clerk/react (Core 3) drops the old SignedIn/SignedOut components in
// favor of reading session state directly.
function ClerkPoCContent() {
  const { isSignedIn } = useAuth()
  // Core 3 no longer accepts the old virtual router mode. Hash routing keeps
  // this deliberately self-contained, dev-only proof-of-connectivity panel.
  return isSignedIn ? <UserButton /> : <SignIn routing="hash" />
}

export function ClerkPoCPanel() {
  if (!import.meta.env.DEV) return null
  if (!publishableKey) {
    return (
      <div style={{ position: 'fixed', bottom: 8, right: 8, zIndex: 999, font: '12px monospace', color: 'crimson' }}>
        VITE_CLERK_PUBLISHABLE_KEY missing -- run `clerk env pull`
      </div>
    )
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <div
        style={{
          position: 'fixed',
          top: 8,
          right: 8,
          zIndex: 999,
          background: 'white',
          border: '1px solid #ccc',
          borderRadius: 8,
          padding: 8,
          maxHeight: 'calc(100vh - 16px)',
          overflow: 'auto',
        }}
      >
        <p style={{ font: '11px monospace', margin: '0 0 6px' }}>Clerk PoC (KES-189, dev only)</p>
        <ClerkPoCContent />
      </div>
    </ClerkProvider>
  )
}
