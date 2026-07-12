import { useEffect, useState } from 'react'
import { ClientResponseError } from 'pocketbase'
import { pb } from './pocketbase'

export interface AuthUser {
  id: string
  email: string
}

function currentUser(): AuthUser | null {
  const model = pb.authStore.record
  if (!model) return null
  return { id: model.id as string, email: model.email as string }
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

export async function signUp(email: string, password: string): Promise<void> {
  await pb.collection('users').create({ email, password, passwordConfirm: password })
  await pb.collection('users').authWithPassword(email, password)
}

export function signOut(): void {
  pb.authStore.clear()
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
