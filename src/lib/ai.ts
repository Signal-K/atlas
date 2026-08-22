import { pb } from './pocketbase'

// Proxies to the Claude API server-side (pocketbase/pb_hooks/ask-atlas.pb.js)
// -- the API key never reaches the client, and the hook rejects non-Sky-Pass
// accounts before spending a metered API call. That endpoint requires a
// server-side ANTHROPIC_API_KEY and is not enabled on every deployment, same
// pattern as eclipseRoadmap.ts/tripGuide.ts.
export async function askAtlas(question: string, context?: string): Promise<string> {
  if (!pb.authStore.isValid) throw new Error('Sign in to ask Atlas a question.')

  const res = await pb.send<{ answer?: string }>('/atlas/ask', {
    method: 'POST',
    // pb.send() only JSON-encodes a plain-object body when Content-Type is
    // explicitly "application/json" -- without this header it hands the
    // object straight to fetch(), which doesn't accept one.
    headers: { 'Content-Type': 'application/json' },
    body: { question, context },
  })

  const answer = res?.answer
  if (!answer) throw new Error('Could not get an answer right now.')
  return answer
}
