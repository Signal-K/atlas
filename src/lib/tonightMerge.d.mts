export function combineTonightTargets<T extends { eventId: string }>(
  primary: readonly T[],
  extra: readonly T[],
  rating: string,
  limit?: number,
): T[]
