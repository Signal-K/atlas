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

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `VITE_PB_URL` in `.env.local` to the PocketBase instance to use.

## GitHub Actions

Two scheduled workflows run against the shared PocketBase instance directly
(not through the app runtime):

- `.github/workflows/ingest.yml` — runs every event-source plugin daily and
  upserts into `sky_events` (`npm run ingest` / `scripts/ingest.mjs`).
- `.github/workflows/notify.yml` — checks each user's watchlist against
  upcoming events + weather and sends web-push notifications
  (`npm run notify` / `scripts/notify.mjs`).

Both need these repo secrets set (Settings &rarr; Secrets and variables &rarr;
Actions):

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
pushes `dist/` to Cloudflare Pages on every push to `main`, using
[`cloudflare/pages-action`](https://github.com/cloudflare/pages-action).

Needs, in this repo's GitHub settings:

- Secrets: `CLOUDFLARE_API_TOKEN` (Pages:Edit permission), `CLOUDFLARE_ACCOUNT_ID`.
- Variables (Settings &rarr; Secrets and variables &rarr; Actions &rarr;
  Variables, not secrets — these end up in the public client bundle):
  `VITE_PB_URL`, `VITE_VAPID_PUBLIC_KEY`.
- A Cloudflare Pages project named `atlas` (create it once via the Cloudflare
  dashboard or `wrangler pages project create atlas`); the workflow deploys
  to it by name, it doesn't create it.
