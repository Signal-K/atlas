// PocketBase stores and returns datetimes as "YYYY-MM-DD HH:MM:SS.sssZ" --
// a space, not "T" -- which is not valid ECMA-262 Date Time String Format.
// V8 (Chrome, Node -- everything this was developed and tested against)
// accepts the space as a lenient extension, but JavaScriptCore (real
// Safari/WebKit, desktop and iOS) is spec-strict and returns Invalid Date
// for it. Every raw PocketBase datetime field must be normalized through
// this before being handed to `new Date(...)` -- skipping it doesn't fail
// loudly, it just makes every date-dependent computation downstream
// silently wrong (or throw) in Safari alone.
export function parsePbDate(raw: string): Date {
  return new Date(raw.includes('T') ? raw : raw.replace(' ', 'T'))
}
