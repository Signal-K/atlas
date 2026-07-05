import { useEffect, useState } from 'react'
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
