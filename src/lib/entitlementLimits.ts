// Central free-vs-paid caps for lookahead windows. Free accounts get a
// useful taste (10 days of events in their own location, 3 days of
// sky-condition forecast); Sky Pass removes both caps. Kept in one place so
// the mobile Today/Events/Plan surfaces and the weather widget agree on the
// same numbers instead of drifting per call site.
export const FREE_EVENT_LOOKAHEAD_DAYS = 10
// Sky events are only synced/generated this far out in practice -- treat it
// as "unlimited" from the UI's perspective rather than hardcoding a bigger
// number that outruns the actual data.
export const PAID_EVENT_LOOKAHEAD_DAYS = 365

export const FREE_FORECAST_DAYS = 3
// Open-Meteo's daily forecast tops out around 16 days -- that's the real
// ceiling "unlimited" maps to for a paid account.
export const PAID_FORECAST_DAYS = 16

export function eventLookaheadDays(entitled: boolean): number {
  return entitled ? PAID_EVENT_LOOKAHEAD_DAYS : FREE_EVENT_LOOKAHEAD_DAYS
}

export function forecastLookaheadDays(entitled: boolean): number {
  return entitled ? PAID_FORECAST_DAYS : FREE_FORECAST_DAYS
}
