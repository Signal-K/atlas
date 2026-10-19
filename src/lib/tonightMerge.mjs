// The hub's TARGETS count used to be "calendar events whose start falls in
// tonight's window". On a quiet night that is 0, while search still lists the
// stars and clusters that are actually up. Those observing targets belong in
// the same count. A cloudy "skip" night still names them; the headline carries
// the weather warning.

export function combineTonightTargets(primary, extra, _rating, limit = 8) {
  const seen = new Set(primary.map((target) => target.eventId))
  const rest = extra.filter((target) => !seen.has(target.eventId))
  return [...primary, ...rest].slice(0, limit)
}
