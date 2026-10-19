interface GeneratedGlobalSkyEvent {
  kind: string
  target: string
  title: string
  description: string
  content?: string
  starts_at: string
  ends_at?: string
}

export function fetchEvents(input: { now?: Date; windowDays?: number }): Promise<GeneratedGlobalSkyEvent[]>

export interface OrionidsActivity {
  target: 'orionids'
  year: number
  startsAt: string
  endsAt: string
  peakAt: string
}

export function orionidsActivity(year: number): OrionidsActivity
