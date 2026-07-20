# Atlas

Offline-first astronomical events, calendar, watchlist, and citizen-science
companion webapp, backed by the shared Star Sailors PocketBase instance.

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

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `VITE_PB_URL` in `.env.local` to the PocketBase instance to use.

## GitHub Actions

CI and deploys (`.github/workflows/ci.yml`, `deploy.yml`, `preview-deploy.yml`)
run on every push/PR — see [Deploy target](#deploy-target) below.

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
production. Both run the full test suite (`npm test`, including a real
local PocketBase for the write-action E2E) before deploying — see
`ci.yml`/`deploy.yml` for the exact gate.

Needs, in this repo's GitHub settings:

- Secrets: `CLOUDFLARE_API_TOKEN` (Pages:Edit permission), `CLOUDFLARE_ACCOUNT_ID`.
- Variables (Settings &rarr; Secrets and variables &rarr; Actions &rarr;
  Variables, not secrets — these end up in the public client bundle):
  `VITE_PB_URL`, `VITE_VAPID_PUBLIC_KEY`, `VITE_POSTHOG_KEY`,
  `VITE_POSTHOG_HOST`.
- Optional repository/environment secrets for server-side analytics tooling:
  `POSTHOG_PROJECT_ID`, `POSTHOG_PERSONAL_API_KEY`. Do not add the personal
  API key as a `VITE_*` variable.
- A Cloudflare Pages project named `atlas` (create it once via the Cloudflare
  dashboard or `wrangler pages project create atlas`); the workflow deploys
  to it by name, it doesn't create it.
