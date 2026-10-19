export const GUEST_ASK_LIMIT: number
export const GUEST_ASK_LIMIT_CODE: string
export const GUEST_ASK_BURST_CODE: string
export const GUEST_ASK_STORAGE_KEY: string

export function guestAskDecision(used: number, limit?: number): { allowed: boolean; remaining: number }

export function isGuestAskLimitMessage(message: unknown): boolean

export function isGuestAskBurstMessage(message: unknown): boolean

export function utcDayKey(date?: Date): string

export function readGuestAskUsed(raw: string | null | undefined, now?: Date): number

export function writeGuestAskUsed(used: number, now?: Date): string
