import { pb } from './pocketbase'

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
}

function requireUser() {
  const user = pb.authStore.record
  if (!user) throw new Error('Must be signed in')
  return user
}

export async function listDiscoveries(): Promise<Discovery[]> {
  const [records, votes] = await Promise.all([
    pb.collection('atlas_discoveries').getFullList({ sort: '-created' }),
    pb.collection('atlas_discovery_votes').getFullList(),
  ])

  const currentUserId = pb.authStore.record?.id
  const countByDiscovery = new Map<string, number>()
  const votedByCurrentUser = new Set<string>()
  for (const vote of votes) {
    countByDiscovery.set(vote.discovery, (countByDiscovery.get(vote.discovery) ?? 0) + 1)
    if (currentUserId && vote.user === currentUserId) votedByCurrentUser.add(vote.discovery)
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
    created: record.created,
    voteCount: countByDiscovery.get(record.id) ?? 0,
    hasVoted: votedByCurrentUser.has(record.id),
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

export async function listComments(discoveryId: string): Promise<DiscoveryComment[]> {
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
