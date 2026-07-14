import type { ObservationLogEntry } from './db'

const CSV_COLUMNS: Array<{ key: keyof ObservationLogEntry; header: string }> = [
  { key: 'observedAt', header: 'Observed at' },
  { key: 'targetName', header: 'Target' },
  { key: 'note', header: 'Note' },
  { key: 'attemptRating', header: 'Rating' },
  { key: 'deviceUsed', header: 'Device' },
  { key: 'cameraRecipeUsed', header: 'Camera recipe' },
  { key: 'locationLabel', header: 'Location' },
  { key: 'conditionSummary', header: 'Conditions' },
]

function csvEscape(value: unknown): string {
  const str = value == null ? '' : String(value)
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

// Plain CSV rather than a specific citizen-science project's submission
// format (Globe at Night, AAVSO, etc. each want different columns/units) —
// this is a portable personal record the user can reshape for whichever
// project they're submitting to, not a direct-submit integration.
export function observationsToCsv(entries: ObservationLogEntry[]): string {
  const header = CSV_COLUMNS.map((col) => csvEscape(col.header)).join(',')
  const rows = entries.map((entry) => CSV_COLUMNS.map((col) => csvEscape(entry[col.key])).join(','))
  return [header, ...rows].join('\n')
}

export function downloadObservationsCsv(entries: ObservationLogEntry[]) {
  const csv = observationsToCsv(entries)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `atlas-observations-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
