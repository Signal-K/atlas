import type { RecordModel } from 'pocketbase'
import { pb } from './pocketbase'
import type { SkyEvent } from './db'

export interface PhotoChallenge {
  id: string
  title: string
  target: string
  prompt: string
  tip: string
  // Photo Challenges is event-tied, not an evergreen prompt (per the
  // answered scope in b0wx8o) -- a challenge only becomes active when a
  // matching sky_event is live, matched by SkyEvent.kind.
  matchingKinds: SkyEvent['kind'][]
}

export const PHOTO_CHALLENGES: PhotoChallenge[] = [
  {
    id: 'moon-context',
    title: 'Moon with context',
    target: 'Moon',
    prompt: 'Capture the Moon with a foreground landmark, skyline, tree line, or cloud texture.',
    tip: 'Mention phase, time, and what made the framing work.',
    matchingKinds: ['moon_phase', 'eclipse'],
  },
  {
    id: 'meteor-watch',
    title: 'Meteor watch frame',
    target: 'Meteor shower',
    prompt: 'Share a wide-sky frame from a meteor-watch session, even if the meteor missed the shot.',
    tip: 'Include shower name, direction faced, and how long you watched.',
    matchingKinds: ['meteor_shower'],
  },
  {
    id: 'planet-hunt',
    title: 'Planet hunt',
    target: 'Visible planet',
    prompt: 'Photograph or sketch a visible planet near the horizon, Moon, or bright reference star.',
    tip: 'Add the planet name and how you identified it.',
    matchingKinds: ['planet_event', 'conjunction'],
  },
]

export function discoveryCaptionForChallenge(challenge: PhotoChallenge): string {
  return `${challenge.title}: ${challenge.prompt}`
}

// Event-tied matching: which challenges are live for a given active/upcoming
// sky event. Reuses the existing event model -- no new event source.
export function getChallengesForEvent(event: Pick<SkyEvent, 'kind'>): PhotoChallenge[] {
  return PHOTO_CHALLENGES.filter((challenge) => challenge.matchingKinds.includes(event.kind))
}

export interface PhotoChallengeSubmission {
  id: string
  eventId: string
  eventTitle: string
  challengeId: string
  caption: string
  imageUrl: string
  approved: boolean
  created: string
  isMine: boolean
}

export interface NewPhotoChallengeSubmission {
  eventId: string
  challengeId: string
  caption: string
  image: File
}

function requireUser() {
  const user = pb.authStore.record
  if (!user) throw new Error('Must be signed in')
  return user
}

function mapSubmission(record: RecordModel): PhotoChallengeSubmission {
  const currentUserId = pb.authStore.record?.id
  return {
    id: record.id,
    eventId: record.event,
    eventTitle: record.expand?.event?.title ?? '',
    challengeId: record.challenge_id,
    caption: record.caption ?? '',
    imageUrl: record.image ? pb.files.getURL(record, record.image) : '',
    approved: Boolean(record.approved),
    created: record.created,
    isMine: currentUserId === record.user,
  }
}

// Submitting writes with `approved` left unset (defaults false) -- the
// submission is shadowbanned (visible only to its author) until a
// superuser approves it via the admin UI, surfaced by the scheduled
// moderation scan (scripts/moderate-photo-challenges.mjs).
export async function submitPhotoChallenge(input: NewPhotoChallengeSubmission): Promise<void> {
  const user = requireUser()
  const form = new FormData()
  form.append('user', user.id as string)
  form.append('event', input.eventId)
  form.append('challenge_id', input.challengeId)
  form.append('caption', input.caption)
  form.append('image', input.image)
  await pb.collection('atlas_photo_challenge_submissions').create(form)
}

// The list/view rule (`approved = true || user = @request.auth.id`) already
// restricts what comes back to "approved, or mine" -- this single query
// covers both "my submissions" (including pending) and "the public feed"
// depending on how the caller filters/labels the result.
export async function listPhotoChallengeSubmissions(): Promise<PhotoChallengeSubmission[]> {
  try {
    const records = await pb.collection('atlas_photo_challenge_submissions').getFullList({
      sort: '-created',
      expand: 'event',
    })
    return records.map(mapSubmission)
  } catch {
    return []
  }
}
