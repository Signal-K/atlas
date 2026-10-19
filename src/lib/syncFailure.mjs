// ASV-112: `sync_failed` used to carry only a stage and String(err), so the
// failures could not be told apart (offline vs 5xx vs auth). This derives a
// small, PII-free diagnosis from whatever the call site already passes.

const NAME_PATTERN = /^([A-Za-z][A-Za-z0-9]*(?:Error|Exception))\b/
const STATUS_PATTERN = /\b([1-5]\d{2})\b/

function statusClass(status) {
  return `${Math.floor(status / 100)}xx`
}

export function describeSyncFailure(properties = {}, online = true) {
  const raw = typeof properties.error === 'string' ? properties.error : ''
  const explicitStatus = Number.isInteger(properties.status) ? properties.status : null
  const parsedStatus = explicitStatus ?? (STATUS_PATTERN.test(raw) ? Number(raw.match(STATUS_PATTERN)[1]) : null)
  const name = raw.match(NAME_PATTERN)?.[1]

  let reason = properties.reason
  if (!reason) {
    if (!online) reason = 'offline'
    else if (parsedStatus) reason = statusClass(parsedStatus)
    else if (/failed to fetch|network ?error|load failed|networkerror/i.test(raw)) reason = 'network'
    else if (/abort|timeout|timed out/i.test(raw)) reason = 'timeout'
    else reason = name ?? 'unknown'
  }

  return {
    ...properties,
    reason,
    ...(parsedStatus ? { status: parsedStatus } : {}),
    online,
    attempt: Number.isInteger(properties.attempt) ? properties.attempt : 1,
  }
}
