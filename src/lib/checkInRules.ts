// The one place the free/Sky Pass difference is decided.
//
// Deliberately a table rather than conditionals scattered across the sheet and
// the writer: the UI ("is submit enabled?") and the write path ("may this be
// saved?") have to agree, and the only way to guarantee that is for both to ask
// the same function. Adding a third call site should mean calling this, not
// re-deriving the rule.
//
// Scope note: tonight's check-in stays photo-optional for everyone. Free users
// could always check in to tonight without a photo, so making that conditional
// would take away something that already works.

export type CheckInKind = 'tonight' | 'past'

export interface CheckInPolicy {
  kind: CheckInKind
  /** Whether the submit control should be disabled until a photo is attached. */
  photoRequired: boolean
  /**
   * Why, in the user's terms -- the sheet shows this next to the disabled
   * button rather than inventing its own explanation.
   */
  photoRequiredReason: string | null
}

const FREE_PAST_PHOTO_REASON =
  "Checking in to a past night needs a photo — it's how we know it happened. Sky Pass lets you backdate without one."

/**
 * True only for a free user backdating. Every other combination is false.
 *
 * There is intentionally no server-side counterpart. `atlas_observations`
 * accepts writes from any authenticated user regardless of entitlement, and a
 * server rule would be new infrastructure enforcing a soft product rule; the
 * writer below is the enforcement point instead.
 */
export function checkInPolicyFor(kind: CheckInKind, entitled: boolean): CheckInPolicy {
  const photoRequired = kind === 'past' && !entitled
  return {
    kind,
    photoRequired,
    photoRequiredReason: photoRequired ? FREE_PAST_PHOTO_REASON : null,
  }
}

/**
 * Thrown by the writer when a free user tries to backdate without a photo.
 *
 * A typed error rather than a boolean return: the sheet already prevents this
 * from being reachable, so reaching it means a caller bypassed the UI, and that
 * should be loud rather than a silent no-op.
 */
export class PhotoRequiredError extends Error {
  readonly kind: CheckInKind = 'past'

  constructor() {
    super(checkInPolicyFor('past', false).photoRequiredReason ?? 'A photo is required.')
    this.name = 'PhotoRequiredError'
  }
}
