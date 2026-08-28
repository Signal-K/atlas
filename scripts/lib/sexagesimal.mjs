// Shared sexagesimal (HH:MM:SS / +DD:MM:SS) coordinate parsing for the
// catalog generator scripts (generate-bright-stars.mjs,
// generate-messier-catalog.mjs). Both consume VizieR/CDS-style astronomical
// TSV/CSV exports that use this format for RA and Dec, so this is factored
// out rather than duplicated -- a bug here (see parseSexagesimal below)
// would otherwise need fixing twice.

export function parseSexagesimal(value, scale) {
  if (!value) return null
  const trimmed = value.trim()
  // Strip a leading sign as its own character first, rather than replacing
  // it with a space. Replacing it with a space instead leaves a leading
  // space before the first digit group, and splitting on /\s+/ then
  // produces a leading empty string, which silently shifts every value one
  // index left (minutes lands in the degrees slot, seconds in the minutes
  // slot, and the real degrees value is discarded entirely). That exact bug
  // affected 100% of declinations the first time this ran for real, since
  // every signed coordinate starts with + or -, and went undetected because
  // the script had only ever run against its no-network fallback list.
  const sign = trimmed.startsWith('-') ? -1 : 1
  const withoutSign = trimmed.replace(/^[+-]/, '')
  const parts = withoutSign.replace(/:/g, ' ').trim().split(/\s+/).map(Number)
  if (parts.length === 0 || parts.some((part) => Number.isNaN(part))) return null
  const abs = Math.abs(parts[0] ?? 0) + (parts[1] ?? 0) / 60 + (parts[2] ?? 0) / 3600
  return sign * abs * scale
}

export function parseRaHours(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const sexagesimal = /[:\s]/.test(raw) ? parseSexagesimal(raw, 1) : null
  if (sexagesimal != null) return sexagesimal > 24 ? sexagesimal / 15 : sexagesimal
  const decimal = Number(raw)
  if (!Number.isFinite(decimal)) return null
  return decimal > 24 ? decimal / 15 : decimal
}

export function parseDecDeg(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const sexagesimal = /[:\s]/.test(raw) ? parseSexagesimal(raw, 1) : null
  if (sexagesimal != null) return sexagesimal
  const decimal = Number(raw)
  return Number.isFinite(decimal) ? decimal : null
}
