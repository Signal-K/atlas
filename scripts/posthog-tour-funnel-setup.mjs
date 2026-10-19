#!/usr/bin/env node

const PROJECT_ID = process.env.POSTHOG_PROJECT_ID
const PERSONAL_API_KEY = process.env.POSTHOG_PERSONAL_API_KEY
const POSTHOG_HOST = process.env.POSTHOG_HOST ?? 'https://us.posthog.com'
const DASHBOARD_ID = 2093974
const INSIGHT_NAME = 'Atlas tour activation: started → completed'

if (!PROJECT_ID || !PERSONAL_API_KEY) {
  console.error('POSTHOG_PROJECT_ID and POSTHOG_PERSONAL_API_KEY are required.')
  process.exit(1)
}

async function posthogFetch(path, options = {}) {
  const response = await fetch(`${POSTHOG_HOST}/api/projects/${PROJECT_ID}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${PERSONAL_API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!response.ok) throw new Error(`PostHog ${options.method ?? 'GET'} ${path} failed: ${response.status} ${await response.text()}`)
  return response.status === 204 ? null : response.json()
}

const query = {
  kind: 'FunnelsQuery',
  series: [
    { kind: 'EventsNode', event: 'Tour started', name: 'Tour started', math: 'total' },
    { kind: 'EventsNode', event: 'Tour completed', name: 'Tour completed', math: 'total' },
  ],
  dateRange: { date_from: '-30d' },
  funnelsFilter: { funnelWindowInterval: 14, funnelWindowIntervalUnit: 'day' },
  properties: [{ type: 'event', key: '$host', operator: 'exact', value: ['youratlas.cc'] }],
  filterTestAccounts: true,
}

async function main() {
  const search = await posthogFetch(`/insights/?search=${encodeURIComponent(INSIGHT_NAME)}`)
  const existing = search.results?.find((insight) => insight.name === INSIGHT_NAME)
  const body = {
    name: INSIGHT_NAME,
    description: 'Primary Atlas value funnel. Host-filtered; no invented target conversion rate.',
    query,
    dashboards: [DASHBOARD_ID],
    tags: ['atlas', 'growth', 'tour'],
  }
  const insight = existing
    ? await posthogFetch(`/insights/${existing.id}/`, { method: 'PATCH', body: JSON.stringify(body) })
    : await posthogFetch('/insights/', { method: 'POST', body: JSON.stringify(body) })
  console.log(`${existing ? 'Updated' : 'Created'} ${INSIGHT_NAME}: ${POSTHOG_HOST}/project/${PROJECT_ID}/insights/${insight.short_id}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
