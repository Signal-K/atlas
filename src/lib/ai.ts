import { pb } from './pocketbase'

// Proxies to the Claude API server-side (backend/main.go's handleAskAtlas) --
// the API key never reaches the client, and the backend rejects non-Sky-Pass
// accounts before spending a metered API call.
export async function askAtlas(question: string, context?: string): Promise<string> {
  const res = await pb.send<{ answer: string }>('/ai/ask', {
    method: 'POST',
    body: { question, context },
  })
  return res.answer
}
