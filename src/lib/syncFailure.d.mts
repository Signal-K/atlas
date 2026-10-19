export interface SyncFailureProperties {
  stage?: string
  error?: string
  reason?: string
  status?: number
  attempt?: number
  [key: string]: unknown
}

export function describeSyncFailure(
  properties?: SyncFailureProperties,
  online?: boolean,
): SyncFailureProperties & { reason: string; online: boolean; attempt: number }
