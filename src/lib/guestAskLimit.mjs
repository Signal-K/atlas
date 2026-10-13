// Logged-out Ask Atlas allowance. The server hook is the authority (an IP can
// clear localStorage); this module is the shared decision the client uses to
// show the sign-up prompt and the unit tests pin.

export const GUEST_ASK_LIMIT = 3
export const GUEST_ASK_LIMIT_CODE = 'guest_ask_limit'

export function guestAskDecision(used, limit = GUEST_ASK_LIMIT) {
  const count = Math.max(0, Number(used) || 0)
  if (count >= limit) return { allowed: false, remaining: 0 }
  return { allowed: true, remaining: limit - count }
}

export function isGuestAskLimitMessage(message) {
  return String(message || '').includes(GUEST_ASK_LIMIT_CODE)
}

export const GUEST_ASK_BURST_CODE = 'guest_ask_burst'
export const GUEST_ASK_STORAGE_KEY = 'atlas.guest-ask.v1'

export function utcDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

export function readGuestAskUsed(raw, now = new Date()) {
  if (!raw) return 0
  try {
    const parsed = JSON.parse(raw)
    if (parsed.day !== utcDayKey(now)) return 0
    return Math.max(0, Number(parsed.used) || 0)
  } catch {
    return 0
  }
}

export function writeGuestAskUsed(used, now = new Date()) {
  return JSON.stringify({ day: utcDayKey(now), used: Math.max(0, Math.floor(Number(used) || 0)) })
}

export function isGuestAskBurstMessage(message) {
  return String(message || '').includes(GUEST_ASK_BURST_CODE)
}
