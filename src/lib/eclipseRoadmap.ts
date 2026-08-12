import { pb } from './pocketbase'
import type { GuideStep } from './eventGuide'

// Client for the Sky Pass "personalized eclipse viewing plan" endpoint
// (pocketbase/pb_hooks/eclipse-roadmap.pb.js). That endpoint requires a
// server-side ANTHROPIC_API_KEY and is not enabled on every deployment,
// same pattern as photoCaption.ts. Unlike that best-effort auto-caption,
// this is an explicit button tap -- callers should surface the thrown
// error message rather than swallow it.
export interface EclipseRoadmapInput {
  title: string
  locationName: string
  lat: number
  lon: number
  timeZone?: string
  guideSteps: GuideStep[]
}

export async function requestEclipseRoadmap(input: EclipseRoadmapInput): Promise<string> {
  if (!pb.authStore.isValid) throw new Error('Sign in to generate a viewing plan.')

  const result = await pb.send<{ roadmap?: string }>('/atlas/events/eclipse-roadmap', {
    method: 'POST',
    // pb.send() only JSON-encodes a plain-object body when Content-Type is
    // explicitly "application/json" -- without this header it hands the
    // object straight to fetch(), which doesn't accept one.
    headers: { 'Content-Type': 'application/json' },
    body: input,
  })

  const roadmap = result?.roadmap
  if (!roadmap) throw new Error('Could not generate a viewing plan.')
  return roadmap
}
