import type { RecordModel } from 'pocketbase'
import { pb } from './pocketbase'
import { isDemoMode } from './demoMode'

// Small fixed reaction set (mirrors the atlas_discovery_reactions "emoji"
// enum) rather than free-form emoji picking -- lower friction than typing a
// comment, and a fixed set keeps the tally UI simple (no unbounded emoji list).
export const REACTIONS: Array<{ id: string; glyph: string; label: string }> = [
  { id: 'telescope', glyph: '🔭', label: 'I saw this too' },
  { id: 'heart', glyph: '😍', label: 'Love this' },
  { id: 'sparkles', glyph: '✨', label: 'Beautiful' },
  { id: 'wow', glyph: '😲', label: 'Wow' },
]

export interface Discovery {
  id: string
  caption: string
  authorName: string
  target?: string
  imageUrl?: string
  camera?: string
  telescope?: string
  filters?: string
  created: string
  voteCount: number
  hasVoted: boolean
  reactionCounts: Record<string, number>
  myReactions: Set<string>
  // Best-effort, captured from the poster's current location at submit time
  // (see FeedView) -- used to match nearby example photos to events (see
  // examplePhotos.ts), never shown as an exact address.
  latitude?: number
  longitude?: number
}

export interface DiscoveryComment {
  id: string
  authorName: string
  text: string
  created: string
}

export interface NewDiscovery {
  caption: string
  target: string
  camera: string
  telescope: string
  filters: string
  image: File | null
  latitude?: number
  longitude?: number
}

function requireUser() {
  const user = pb.authStore.record
  if (!user) throw new Error('Must be signed in')
  return user
}

// Local-only fixtures for demo mode (see demoMode.ts) so the Feed/Digest
// widgets have something to render without a PocketBase backend.
const DEMO_DISCOVERIES: Discovery[] = [
  {
    id: 'demo-discovery-jupiter',
    caption: 'Jupiter and three Galilean moons, handheld binoculars',
    authorName: 'demo_observer',
    target: 'Jupiter',
    created: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    voteCount: 4,
    hasVoted: false,
    reactionCounts: { telescope: 2, sparkles: 1 },
    myReactions: new Set(),
  },
  {
    id: 'demo-discovery-moon',
    caption: 'Terminator detail on the Moon through a 6" dob',
    authorName: 'demo_observer',
    target: 'Moon',
    created: new Date(Date.now() - 5 * 86_400_000).toISOString(),
    voteCount: 2,
    hasVoted: false,
    reactionCounts: { heart: 1 },
    myReactions: new Set(),
  },
]

export async function listDiscoveries(): Promise<Discovery[]> {
  let records: RecordModel[], votes: RecordModel[], reactions: RecordModel[]
  try {
    ;[records, votes, reactions] = await Promise.all([
      pb.collection('atlas_discoveries').getFullList({ sort: '-created' }),
      pb.collection('atlas_discovery_votes').getFullList(),
      pb.collection('atlas_discovery_reactions').getFullList(),
    ])
  } catch {
    return isDemoMode() ? DEMO_DISCOVERIES : []
  }

  const currentUserId = pb.authStore.record?.id
  const countByDiscovery = new Map<string, number>()
  const votedByCurrentUser = new Set<string>()
  for (const vote of votes) {
    countByDiscovery.set(vote.discovery, (countByDiscovery.get(vote.discovery) ?? 0) + 1)
    if (currentUserId && vote.user === currentUserId) votedByCurrentUser.add(vote.discovery)
  }

  const reactionCountsByDiscovery = new Map<string, Record<string, number>>()
  const myReactionsByDiscovery = new Map<string, Set<string>>()
  for (const reaction of reactions) {
    const counts = reactionCountsByDiscovery.get(reaction.discovery) ?? {}
    counts[reaction.emoji] = (counts[reaction.emoji] ?? 0) + 1
    reactionCountsByDiscovery.set(reaction.discovery, counts)
    if (currentUserId && reaction.user === currentUserId) {
      const mine = myReactionsByDiscovery.get(reaction.discovery) ?? new Set<string>()
      mine.add(reaction.emoji)
      myReactionsByDiscovery.set(reaction.discovery, mine)
    }
  }

  return records.map((record) => ({
    id: record.id,
    caption: record.caption,
    authorName: record.author_name,
    target: record.target || undefined,
    imageUrl: record.image ? pb.files.getURL(record, record.image) : undefined,
    camera: record.camera || undefined,
    telescope: record.telescope || undefined,
    filters: record.filters || undefined,
    latitude: typeof record.latitude === 'number' ? record.latitude : undefined,
    longitude: typeof record.longitude === 'number' ? record.longitude : undefined,
    created: record.created,
    voteCount: countByDiscovery.get(record.id) ?? 0,
    hasVoted: votedByCurrentUser.has(record.id),
    reactionCounts: reactionCountsByDiscovery.get(record.id) ?? {},
    myReactions: myReactionsByDiscovery.get(record.id) ?? new Set<string>(),
  }))
}

export async function createDiscovery(input: NewDiscovery): Promise<void> {
  const user = requireUser()
  const form = new FormData()
  form.append('user', user.id as string)
  form.append('author_name', (user.email as string).split('@')[0])
  form.append('caption', input.caption)
  form.append('target', input.target)
  form.append('camera', input.camera)
  form.append('telescope', input.telescope)
  form.append('filters', input.filters)
  if (input.latitude != null) form.append('latitude', String(input.latitude))
  if (input.longitude != null) form.append('longitude', String(input.longitude))
  if (input.image) form.append('image', input.image)

  await pb.collection('atlas_discoveries').create(form)
}

export async function toggleVote(discoveryId: string, currentlyVoted: boolean): Promise<void> {
  const user = requireUser()
  if (currentlyVoted) {
    const existing = await pb
      .collection('atlas_discovery_votes')
      .getFirstListItem(`discovery = "${discoveryId}" && user = "${user.id}"`)
    await pb.collection('atlas_discovery_votes').delete(existing.id)
  } else {
    await pb.collection('atlas_discovery_votes').create({ discovery: discoveryId, user: user.id })
  }
}

export async function toggleReaction(discoveryId: string, emoji: string, currentlyReacted: boolean): Promise<void> {
  const user = requireUser()
  if (currentlyReacted) {
    const existing = await pb
      .collection('atlas_discovery_reactions')
      .getFirstListItem(`discovery = "${discoveryId}" && user = "${user.id}" && emoji = "${emoji}"`)
    await pb.collection('atlas_discovery_reactions').delete(existing.id)
  } else {
    await pb.collection('atlas_discovery_reactions').create({ discovery: discoveryId, user: user.id, emoji })
  }
}

export async function listComments(discoveryId: string): Promise<DiscoveryComment[]> {
  try {
    const records = await pb.collection('atlas_discovery_comments').getFullList({
      filter: `discovery = "${discoveryId}"`,
      sort: 'created',
    })
    return records.map((record) => ({
      id: record.id,
      authorName: record.author_name,
      text: record.text,
      created: record.created,
    }))
  } catch {
    return []
  }
}

export async function addComment(discoveryId: string, text: string): Promise<void> {
  const user = requireUser()
  await pb.collection('atlas_discovery_comments').create({
    discovery: discoveryId,
    user: user.id,
    author_name: (user.email as string).split('@')[0],
    text,
  })
}
