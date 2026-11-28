export type PlannerGear = 'phone' | 'phone-scope' | 'smart-scope'
export const PLANNER_GEARS: { id: PlannerGear; label: string }[]
export function goNoGo(rating: string, cloudCoverPct: number | null | undefined, moonIlluminationPct: number | null | undefined): { verdict: 'go' | 'maybe' | 'no-go'; label: string; reason: string }
export function howToFor(kind: string, gear: PlannerGear): { text: string; tripod: boolean; timing: string }
