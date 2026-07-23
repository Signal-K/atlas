import { useEffect, useState } from 'react'
import { ClientResponseError } from 'pocketbase'
import { pb } from './pocketbase'

export interface AuthUser {
  id: string
  email: string
  entitled: boolean
}

function currentUser(): AuthUser | null {
  const model = pb.authStore.record
  if (!model) return null
  return { id: model.id as string, email: model.email as string, entitled: Boolean(model.entitled) }
}

// Reactive wrapper around pb.authStore so components re-render on
// sign-in/sign-out. The SDK persists the token itself (localStorage), so
// this is just the React-facing view of that state.
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(currentUser())

  useEffect(() => {
    return pb.authStore.onChange(() => {
      setUser(currentUser())
    })
  }, [])

  return { user }
}

export async function signIn(email: string, password: string): Promise<void> {
  await pb.collection('users').authWithPassword(email, password)
}

function isExistingAccountError(error: unknown): boolean {
  if (!(error instanceof ClientResponseError)) return false
  const fieldErrors = Object.entries(error.response?.data ?? {}) as Array<[string, { code?: string; message?: string }]>
  return fieldErrors.some(([field, details]) => {
    if (field !== 'email') return false
    const code = details?.code?.toLowerCase() ?? ''
    const message = details?.message?.toLowerCase() ?? ''
    return code.includes('unique') || message.includes('already') || message.includes('in use')
  })
}

export async function signUp(email: string, password: string): Promise<void> {
  try {
    await pb.collection('users').create({ email, password, passwordConfirm: password })
  } catch (error) {
    if (!isExistingAccountError(error)) throw error
  }
  await pb.collection('users').authWithPassword(email, password)
}

export function signOut(): void {
  pb.authStore.clear()
}

// Re-fetches the signed-in user's record (e.g. `entitled`, flipped
// server-side by the Polar webhook after a purchase) since the cached
// authStore snapshot only otherwise updates on the next sign-in.
export async function refreshEntitlement(): Promise<AuthUser | null> {
  if (!pb.authStore.isValid) return null
  try {
    // Webhooks are the fast path, but reconciliation makes paid access
    // self-healing if Polar's asynchronous delivery was missed or delayed.
    await pb.send('/entitlement/polar/refresh', { method: 'POST' })
  } catch {
    // Best-effort. authRefresh below still picks up a webhook-applied change.
  }
  try {
    await pb.collection('users').authRefresh()
  } catch {
    // Best-effort -- e.g. offline or PocketBase unreachable; the cached
    // snapshot stays as-is until the next successful refresh.
  }
  return currentUser()
}

// Polar can redirect back a fraction before its order.paid webhook has
// finished. Refresh a few times in the background so a successful purchase
// unlocks without requiring a manual reload or a trip through Settings.
export async function refreshEntitlementAfterCheckout(): Promise<void> {
  const delays = [0, 750, 2_000, 4_000]
  for (const delay of delays) {
    if (delay) await new Promise((resolve) => window.setTimeout(resolve, delay))
    const user = await refreshEntitlement()
    if (!user || user.entitled) return
  }
}

// Surfaces PocketBase's actual per-field validation message (e.g. "email
// already exists", the real password rule) instead of a fixed guess --
// sign-in/sign-up were previously showing the same hardcoded string for
// every failure, which misled users when the real cause was unrelated
// (e.g. this account already existing) to the message shown.
export function authErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ClientResponseError) {
    const fieldErrors = Object.values(error.response?.data ?? {}) as Array<{ message?: string }>
    const firstFieldMessage = fieldErrors.find((field) => field?.message)?.message
    return firstFieldMessage ?? error.response?.message ?? fallback
  }
  return fallback
}
