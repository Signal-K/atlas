import { pb } from './pocketbase'
import { isGuestAskBurstMessage, isGuestAskLimitMessage } from './guestAskLimit.mjs'

// Proxies to the Claude API server-side (pocketbase/pb_hooks/ask-atlas.pb.js).
// The API key never reaches the client. Guests may ask a few questions; the
// hook counts them per IP. Signed-in accounts still need Sky Pass.
export class GuestAskLimitError extends Error {
  constructor() {
    super('guest_ask_limit')
    this.name = 'GuestAskLimitError'
  }
}

export class GuestAskBurstError extends Error {
  constructor() {
    super('guest_ask_burst')
    this.name = 'GuestAskBurstError'
  }
}

function failureText(err: unknown): string {
  if (!err || typeof err !== 'object') return String(err)
  const value = err as { message?: string; response?: { message?: string } }
  return [value.message, value.response?.message].filter(Boolean).join(' ')
}

export async function askAtlas(question: string, context?: string): Promise<string> {
  let res: { answer?: string }
  try {
    res = await pb.send<{ answer?: string }>('/atlas/ask', {
      method: 'POST',
      // pb.send() only JSON-encodes a plain-object body when Content-Type is
      // explicitly "application/json" -- without this header it hands the
      // object straight to fetch(), which doesn't accept one.
      headers: { 'Content-Type': 'application/json' },
      body: { question, context },
    })
  } catch (err) {
    const text = failureText(err)
    if (isGuestAskLimitMessage(text)) throw new GuestAskLimitError()
    if (isGuestAskBurstMessage(text)) throw new GuestAskBurstError()
    if (!pb.authStore.isValid && /requires valid record authorization token|only authenticated users|401/i.test(text)) {
      throw new Error('Ask Atlas is not available from this server yet.')
    }
    throw err instanceof Error ? err : new Error(text || 'Could not get an answer right now.')
  }

  const answer = res?.answer
  if (!answer) throw new Error('Could not get an answer right now.')
  return answer
}
