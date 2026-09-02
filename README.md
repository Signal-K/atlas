# Atlas

Offline-first astronomical events, calendar, watchlist, and citizen-science
companion webapp, backed by the shared Star Sailors PocketBase instance.

**Live app:** https://youratlas.cc/

**OpenAI Build Week track:** Apps for Your Life

**Primary Codex `/feedback` Session ID:** `019f62b3-b014-7da2-bb07-c36fa9fada77`

See `~/Navigation/workspace/projects/atlas/docs/brief.md` for the product
brief and `~/Navigation/pm-vault` (project `atlas`, ticket prefix `AT`) for
the ticket breakdown.

## Stack

- Vite + React + TypeScript, installable as a PWA (`vite-plugin-pwa`).
- Local-first data layer: IndexedDB (Dexie) mirrors the PocketBase
  collections; a sync queue flushes offline writes when reconnected
  (`src/lib/db.ts`, full sync engine tracked as AT-003).
- PocketBase JS SDK client in `src/lib/pocketbase.ts`.
- Widget-based dashboard: widgets self-register via
  `src/widgets/registry.ts` (events, watchlist, weather, streak,
  citizen-science &mdash; see AT-005 through AT-009).
- Event-source plugins (moon phase, meteor showers, ISS passes, ...) run
  out-of-band via scheduled GitHub Actions workflows, not in the app
  runtime (AT-004, AT-010, AT-011).

## How Codex and GPT-5.6 were used

Atlas existed before OpenAI Build Week and was meaningfully extended during
the submission period. GPT-5.6 Sol was used through Codex as the primary
engineering and product collaborator; Atlas does not call an LLM at runtime.

Codex worked directly in the repository to inspect the existing architecture,
turn product feedback into implementation slices, edit React/TypeScript/CSS,
run headless Playwright checks, and maintain the build. It was especially
useful where the work crossed several layers at once:

- Rebuilt the mobile experience around a Today hub, compact local Events flow,
  Plan, Journal, responsive navigation shell, profile menu, and settings.
- Replaced the decorative sky graphic with astronomy-engine positions for
  stars, planets, the Moon, and curated deep-sky objects, plus compass and
  accelerometer pointing in the full-screen map.
- Designed phone-specific camera guidance and downloadable preset bundles for
  recent Apple, Google, Nothing, and Samsung flagships, with an extensible
  fallback for other Android devices.
- Added event reminders, watchlist-to-plan flows, offline persistence, demo
  access, account merging, and focused end-to-end coverage.
- Queried PostHog usage and feedback, found location ambiguity and timezone
  friction, and then implemented region/country suggestions, IANA-timezone
  observing windows, and visible location switching in both shells. The
  evidence and follow-up measurement plan are in
  [`docs/posthog-product-analysis-2026-07-21.md`](docs/posthog-product-analysis-2026-07-21.md).

GPT-5.6 Sol contributed the higher-level reasoning: translating loose visual
references into a coherent mobile information hierarchy, separating the
strategic Today preview from the real planetarium view, researching realistic
camera-preset constraints, tracing timezone bugs through data and presentation
layers, and deciding which PostHog signals justified product changes. Codex
then carried those decisions through implementation and verification.

The repository is currently public at https://github.com/Signal-K/atlas, which
meets the Build Week judge-access requirement without private-repository
invitations. The commit history and the session ID above provide timestamped
evidence of the Build Week work.

## Cloud infra (production)

Quick-reference links for everything Atlas actually runs on. All of these
are shared infrastructure — changes here can affect other apps in the
Star Sailors ecosystem, not just Atlas.

| What | Link | Notes |
| --- | --- | --- |
| Production app | https://youratlas.cc/ | Custom domain on Cloudflare Pages project `atlas`, added 2026-07-17 (zone purchased via Cloudflare Domains). Falls back to https://atlas-4xz.pages.dev/ — **not** `atlas.pages.dev`, that subdomain belongs to an unrelated third party (FieldMaps). |
| Cloudflare Pages dashboard | https://dash.cloudflare.com/ → Workers & Pages → `atlas` | Build logs, deployment history, custom domains, env vars. Requires the account behind `CLOUDFLARE_ACCOUNT_ID`. |
| Production PocketBase (API) | https://signal-k-starsailors.fly.dev | Shared Star Sailors backend — also used by other apps in the ecosystem, not Atlas-specific. Same value as the `PB_URL` / `VITE_PB_URL` secrets/vars below. |
| PocketBase admin UI | https://signal-k-starsailors.fly.dev/_/ | Superuser login required — this is where to inspect/edit `sky_events`, `atlas_observations`, users, etc. directly, and where to clean up any test data. |
| Fly.io app dashboard | https://fly.io/apps/signal-k-starsailors | Machine status, logs, restarts for the PocketBase host. |
| GitHub Actions runs | https://github.com/Signal-K/atlas/actions | CI, deploys, and the three scheduled jobs below. |
| GitHub repo secrets/vars | https://github.com/Signal-K/atlas/settings/secrets/actions | Where `PB_URL`, `CLOUDFLARE_API_TOKEN`, etc. (below) actually live. |

Local dev talks to the same production PocketBase by default
(`.env.example` → `VITE_PB_URL=https://signal-k-starsailors.fly.dev`) unless
you override it with a local/Docker instance. For battery-friendly local work,
prefer `make up`: it runs only PocketBase in Docker and runs Vite on the host.
Use `make docker-up` only when you explicitly need the frontend container.
Use `make demo` for a no-Docker demo-mode frontend.

### Demo access links

Atlas supports server-authorized demo/free-access links for people who should
be able to sign up without paying. Create an admin-only PocketBase record in
`atlas_demo_access_links` with an active `code`, optional `expires_at`, optional
`max_redemptions`, and a short `reason`. Then share either
`https://youratlas.cc/demo/<code>` or `https://youratlas.cc/?demo=<code>`.

The frontend stores the code locally and redeems it only after the visitor has
authenticated. PocketBase validates the code, records the redemption in
`atlas_demo_access_redemptions`, flips the user's `entitled` field, and the app
refreshes the auth record so Sky Pass access appears without checkout.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `VITE_PB_URL` in `.env.local` to the PocketBase instance to use.

For the quickest judge/demo path, no backend is required:

```bash
make demo
```

Then open the local URL printed by Vite. Stop it with `make demo stop`.

## Verification

```bash
npm run lint
npm run build
npx playwright test
```

Playwright is fully headless by default. Network-dependent astronomy, weather,
geocoding, compass, and account scenarios use deterministic test fixtures.
The normal suite never starts PocketBase or creates a superuser. The optional
write-action check uses an already-provisioned, non-production Atlas backend:

```bash
E2E_WRITE_PB_URL=http://localhost:8094 npm run test:e2e:writes
```

It is intentionally not part of push/deploy CI. Do not point it at production:
it creates and removes a Clerk test user and writes a smoke observation.

## GitHub Actions

CI and deploys (`.github/workflows/ci.yml`, `deploy.yml`, `preview-deploy.yml`)
run on every push/PR without creating an empty PocketBase instance or asking
for a new superuser — see [Deploy target](#deploy-target) below.

Three scheduled workflows run against the shared PocketBase instance
directly (not through the app runtime, and not gated on CI passing):

- `.github/workflows/ingest.yml` — runs every event-source plugin daily and
  upserts into `sky_events` (`npm run ingest` / `scripts/ingest.mjs`).
- `.github/workflows/notify.yml` — checks each user's watchlist against
  upcoming events + weather, delivers explicit get-ready reminders, and sends web-push notifications
  (`npm run notify` / `scripts/notify.mjs`).
- `.github/workflows/moderate.yml` — surfaces pending Photo Challenge
  submissions for admin approval a few times a day (`npm run moderate` /
  `scripts/moderate-photo-challenges.mjs`); doesn't auto-approve anything.

All three need these repo secrets set (Settings &rarr; Secrets and
variables &rarr; Actions):

- `PB_URL` — the shared PocketBase URL (same value as `VITE_PB_URL`).
- `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD` — a PocketBase superuser account,
  used to read/write across all users' records (row-level rules restrict
  normal auth tokens to their own data).
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — for `notify.yml` only. Generate
  with `npm run vapid` (same pattern as `pb-observer`). The public key must
  also be set as `VITE_VAPID_PUBLIC_KEY` wherever the frontend is deployed,
  so subscriptions are created against the matching key pair.

## Deploy target

Cloudflare Pages (AT-012) — Atlas is a static SPA build with no server
component, so a static host is simpler and cheaper than a Fly.io app that
would just be serving files. `.github/workflows/deploy.yml` builds and
pushes `dist/` to Cloudflare Pages on every push to `master` (this repo's
default branch — not `main`), using
[`cloudflare/pages-action`](https://github.com/cloudflare/pages-action).
`.github/workflows/preview-deploy.yml` does the same for every push to any
other branch, landing on a Cloudflare Pages preview URL instead of
production. Both run the full deterministic test suite (`npm test`) before
deploying. Write-action E2E is explicit and only targets an already-provisioned
non-production backend — see `ci.yml`/`deploy.yml` for the exact gate.

Needs, in this repo's GitHub settings:

- Secrets: `CLOUDFLARE_API_TOKEN` (Pages:Edit permission), `CLOUDFLARE_ACCOUNT_ID`.
- Variables (Settings &rarr; Secrets and variables &rarr; Actions &rarr;
  Variables, not secrets — these end up in the public client bundle):
  `VITE_PB_URL`, `VITE_ATLAS_MEDIA_URL`, `VITE_VAPID_PUBLIC_KEY`, `VITE_POSTHOG_KEY`,
  `VITE_POSTHOG_HOST`.
- Optional repository/environment secrets for server-side analytics tooling:
  `POSTHOG_PROJECT_ID`, `POSTHOG_PERSONAL_API_KEY`. Do not add the personal
  API key as a `VITE_*` variable.
- A Cloudflare Pages project named `atlas` (create it once via the Cloudflare
  dashboard or `wrangler pages project create atlas`); the workflow deploys
  to it by name, it doesn't create it.

### Private photo storage (R2)

Journal photos are ready to move from PocketBase files to the private
`atlas-media` R2 bucket. The app prepares a display-quality JPEG before upload
(maximum edge 4096px at 92% quality), stores it through the `atlas-media`
Worker, and keeps only the R2 object key/size in PocketBase. Private photo
reads are authenticated by the Worker; public share cards use an opaque
observation URL and the Worker checks that the record is public before serving
anything.

This is deliberately a **web master**, not an original-RAW archive: expect
roughly 2–5MB for a modern phone photo. 10GB therefore holds about 2,000–5,000
such uploads. Full-resolution DSLR/RAW originals should become an explicit
paid archival option with lifecycle rules, rather than an invisible default
cost on every check-in.

One-time production activation (R2 is not enabled on the Cloudflare account
yet):

1. Enable R2 in the Cloudflare dashboard, then run `wrangler r2 bucket create atlas-media --location=weur`.
2. Deploy `workers/atlas-media` with `wrangler deploy --config workers/atlas-media/wrangler.jsonc`; copy its `workers.dev` URL into the GitHub Actions variable `VITE_ATLAS_MEDIA_URL`.
3. Ensure the deployment API token can deploy Workers and bind/read the R2 bucket, then deploy PocketBase with migration `20260813130000_atlas_observation_r2_media.js` before deploying the frontend.

Until `VITE_ATLAS_MEDIA_URL` is set, the app deliberately retains the existing
PocketBase attachment path, so this rollout is reversible and does not strand
current photos.
