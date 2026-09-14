#!/usr/bin/env node
// One-time (idempotent, safe to rerun) provisioning script: creates or
// updates the PostHog Survey objects that back src/components/FeedbackDock.tsx
// via PostHog's native Surveys product, instead of the dock's fully local
// trigger/dedup logic being the only place survey "existence" lives.
//
// Surveys are created as type "api" (headless) -- PostHog never injects its
// own widget. Atlas keeps rendering FeedbackDock's existing markup; this
// only gives PostHog's dashboard a real Survey object to attribute
// getActiveMatchingSurveys()/capture('survey sent'|'survey shown'|'survey
// dismissed') calls to, so the Surveys analytics tab actually populates.
//
// Requires POSTHOG_PROJECT_ID + POSTHOG_PERSONAL_API_KEY (server-side/admin
// only -- see .env.example). Run with:
//   POSTHOG_PROJECT_ID=... POSTHOG_PERSONAL_API_KEY=... node scripts/posthog-surveys-setup.mjs
//
// Prints the resulting survey IDs as VITE_POSTHOG_*_SURVEY_ID=... lines --
// paste those into your deployment env (and .env for local dev) to switch
// FeedbackDock over from its legacy custom event names to PostHog's native
// survey event schema.

const PROJECT_ID = process.env.POSTHOG_PROJECT_ID
const PERSONAL_API_KEY = process.env.POSTHOG_PERSONAL_API_KEY
const POSTHOG_HOST = process.env.POSTHOG_HOST ?? 'https://us.posthog.com'

const SURVEYS = [
  {
    envVar: 'VITE_POSTHOG_NPS_SURVEY_ID',
    name: 'Atlas NPS (feedback dock)',
    type: 'api',
    questions: [
      {
        type: 'rating',
        display: 'number',
        scale: 11,
        lower_bound_label: '0',
        upper_bound_label: '10',
        question: 'How likely are you to recommend Atlas to someone who watches the sky?',
      },
      {
        type: 'open',
        question: 'What shaped that score?',
        optional: true,
      },
    ],
  },
  {
    envVar: 'VITE_POSTHOG_SURVEY_REMINDER_ID',
    name: 'Atlas micro-survey: reminder feedback',
    type: 'api',
    questions: [
      {
        type: 'single_choice',
        question: 'Was that reminder/check-in useful?',
        choices: ['Yes', 'Somewhat', 'No'],
      },
    ],
  },
  {
    envVar: 'VITE_POSTHOG_SURVEY_TARGET_ID',
    name: 'Atlas micro-survey: target detail clarity',
    type: 'api',
    questions: [
      {
        type: 'single_choice',
        question: 'Did this help you decide what to look for?',
        choices: ['Yes', 'Not sure', 'No'],
      },
    ],
  },
  {
    // ASV-26: shown once after a user's first generated Tonight plan, while
    // the value moment (or the friction that almost prevented it) is fresh.
    envVar: 'VITE_POSTHOG_POSTPLAN_SURVEY_ID',
    name: 'Atlas post-plan product survey',
    type: 'api',
    questions: [
      { type: 'open', question: 'What almost stopped you?', optional: true },
      { type: 'open', question: "What's missing for tomorrow night?", optional: true },
    ],
  },
  {
    // ASV-27: shown once a user reaches the paywall. Pairs with the
    // "Paywall checkout clicked" / "Paywall viewed" feature-property
    // breakdown -- this is the stated-preference half.
    envVar: 'VITE_POSTHOG_PAYWALL_WTP_SURVEY_ID',
    name: 'Atlas paywall WTP survey',
    type: 'api',
    questions: [
      { type: 'open', question: 'What would make this worth paying for?', optional: true },
      {
        type: 'single_choice',
        question: 'What would you expect to pay?',
        choices: ['Free only', '$3-5', '$6-10', 'Tours only'],
      },
    ],
  },
]

async function posthogFetch(path, options = {}) {
  const response = await fetch(`${POSTHOG_HOST}/api/projects/${PROJECT_ID}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${PERSONAL_API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`PostHog API ${options.method ?? 'GET'} ${path} failed: ${response.status} ${body}`)
  }
  return response.status === 204 ? null : response.json()
}

async function findExistingSurvey(name) {
  const results = await posthogFetch(`/surveys/?search=${encodeURIComponent(name)}`)
  return results.results?.find((survey) => survey.name === name) ?? null
}

async function upsertSurvey(spec) {
  const existing = await findExistingSurvey(spec.name)
  const body = { name: spec.name, type: spec.type, questions: spec.questions }

  if (existing) {
    const updated = await posthogFetch(`/surveys/${existing.id}/`, { method: 'PATCH', body: JSON.stringify(body) })
    console.log(`Updated survey "${spec.name}" (${updated.id})`)
    return updated.id
  }

  const created = await posthogFetch('/surveys/', { method: 'POST', body: JSON.stringify(body) })
  console.log(`Created survey "${spec.name}" (${created.id})`)
  return created.id
}

async function main() {
  if (!PROJECT_ID || !PERSONAL_API_KEY) {
    console.error('POSTHOG_PROJECT_ID and POSTHOG_PERSONAL_API_KEY env vars are required.')
    process.exit(1)
  }

  const envLines = []
  for (const spec of SURVEYS) {
    const id = await upsertSurvey(spec)
    envLines.push(`${spec.envVar}=${id}`)
  }

  console.log('\nAdd these to your deployment env (and .env for local dev):\n')
  console.log(envLines.join('\n'))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
